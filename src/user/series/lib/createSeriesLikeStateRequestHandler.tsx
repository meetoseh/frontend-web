import {
  ValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { LoginContextValue } from '../../../shared/contexts/LoginContext';
import { CourseRef } from '../../favorites/lib/CourseRef';
import { constructCancelablePromise } from '../../../shared/lib/CancelablePromiseConstructor';
import { getCurrentServerTimeMS } from '../../../shared/lib/getCurrentServerTimeMS';
import { getJwtExpiration } from '../../../shared/lib/getJwtExpiration';
import { createCancelablePromiseFromCallbacks } from '../../../shared/lib/createCancelablePromiseFromCallbacks';
import { apiFetch } from '../../../shared/ApiConstants';
import { setVWC } from '../../../shared/lib/setVWC';
import { convertUsingMapper } from '../../../admin/crud/CrudFetcher';
import { externalCourseKeyMap } from './ExternalCourse';
import { RequestHandler, Result } from '../../../shared/requests/RequestHandler';
import { mapCancelable } from '../../../shared/lib/mapCancelable';
import { ExpirableCourseRef } from './ExpirableCourseRef';
import { chooseErrorFromStatus, DisplayableError } from '../../../shared/lib/errors';

export type CourseLikeState = {
  /**
   * When the user last liked the course, null if the course is not
   * currently liked, undefined if still loading or this object is no
   * longer in a valid state
   */
  likedAt: ValueWithCallbacks<Date | null | undefined>;
  /**
   * When the liked modal should be closed, if it should be open, otherwise
   * undefined or a value in the past
   */
  showLikedUntil: ValueWithCallbacks<number | undefined>;
  /**
   * When the unliked modal should be closed, if it should be open, otherwise
   * undefined or a value in the past
   */
  showUnlikedUntil: ValueWithCallbacks<number | undefined>;
  /**
   * The last error that occurred, if any.
   */
  error: ValueWithCallbacks<DisplayableError | null>;

  /**
   * Refreshes the current liked status of the course. This will set
   * likedAt to undefined until the refresh is complete. Errors immediately
   * if the course JWT is expired.
   */
  refresh: () => CancelablePromise<void>;
  /**
   * A function which can be called to try to like the course. Will reject
   * if the course JWT is expired.
   */
  like: () => CancelablePromise<void>;
  /**
   * A function which can be called to try to unlike the course. Will reject
   * if the course JWT is expired.
   */
  unlike: () => CancelablePromise<void>;
  /**
   * Convenience function for toggling the like status; rejects if the course
   * JWT is expired.
   */
  toggleLike: () => CancelablePromise<void>;
};

/**
 * Creates a request handler which accepts course refs and returns mutable
 * like states for those courses. A request handler is in many ways overkill
 * for this, but given its available it's a convenient way to manage ownership
 *
 * Normally the request handler abstraction would avoid the need for explicitly
 * passing the reportExpired function in the ref like this, but since
 * CourseLikeState is itself mutable we may try to use the reference outside of
 * the request handlers handling of the ref, and hence e.g. createChainedRequest
 * wouldn't be able to detect all the possible times we might try to use the ref.
 */
export const createSeriesLikeStateRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
  loginContextRaw,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
  loginContextRaw: LoginContextValue;
}): RequestHandler<{ course: { uid: string } }, ExpirableCourseRef, CourseLikeState> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef: getDataFromRef(loginContextRaw),
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: { course: { uid: string } }): string => ref.course.uid;
const getDataFromRef = (
  loginContextRaw: LoginContextValue
): ((ref: ExpirableCourseRef) => CancelablePromise<Result<CourseLikeState>>) => {
  return (ref) => {
    const state = createCourseLikeState({
      loginContextRaw,
      course: ref.course,
      reportExpired: ref.reportExpired,
    });

    return mapCancelable(
      state.refresh(),
      (): Result<CourseLikeState> => ({
        type: 'success',
        data: state,
        error: undefined,
        retryAt: undefined,
      }),
      async (e, state, resolve, reject) => {
        const err =
          e instanceof DisplayableError
            ? new DisplayableError(e.type, 'get like state', e.details)
            : new DisplayableError('client', 'get like state', `${e}`);
        if (state.finishing) {
          state.done = true;
          reject(new DisplayableError('canceled', 'get like state'));
          return;
        }

        state.finishing = true;
        state.done = true;
        resolve({
          type: 'error',
          data: undefined,
          error: err,
          retryAt: undefined,
        });
        return;
      }
    );
  };
};
const compareRefs = (a: ExpirableCourseRef, b: ExpirableCourseRef): number =>
  getJwtExpiration(b.course.jwt) - getJwtExpiration(a.course.jwt);

/**
 * Creates an object that tracks and mutates if the given course is liked by the
 * logged in user. This does not refresh immediately, so the caller should call
 * refresh() to initialize the state.
 */
export const createCourseLikeState = ({
  loginContextRaw,
  course,
  reportExpired,
}: {
  loginContextRaw: LoginContextValue;
  course: CourseRef;
  reportExpired: () => void;
}): CourseLikeState => {
  let reportedExpiration = false;
  const jwtExpiresAt = getJwtExpiration(course.jwt);

  const likedAtVWC = createWritableValueWithCallbacks<Date | null | undefined>(undefined);
  const showLikedUntilVWC = createWritableValueWithCallbacks<number | undefined>(undefined);
  const showUnlikedUntilVWC = createWritableValueWithCallbacks<number | undefined>(undefined);
  const errorVWC = createWritableValueWithCallbacks<DisplayableError | null>(null);

  const refresh = (): CancelablePromise<void> => {
    return constructCancelablePromise({
      body: async (state, resolve, reject) => {
        if (reportedExpiration) {
          state.finishing = true;
          state.done = true;
          reject(
            new DisplayableError(
              'server-refresh-required',
              'refresh series like state',
              'series ref'
            )
          );
          return;
        }

        const loginContext = loginContextRaw.value.get();
        if (loginContext.state !== 'logged-in') {
          state.finishing = true;
          state.done = true;
          reject(
            new DisplayableError(
              'server-refresh-required',
              'refresh series like state',
              'not logged in'
            )
          );
          return;
        }

        const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
        canceled.promise.catch(() => {});
        if (state.finishing) {
          state.done = true;
          reject(new DisplayableError('canceled', 'refresh series like state'));
          canceled.cancel();
          return;
        }

        const serverNow = await getCurrentServerTimeMS();
        if (state.finishing) {
          state.done = true;
          reject(new DisplayableError('canceled', 'refresh series like state'));
          return;
        }

        if (jwtExpiresAt < serverNow) {
          reportExpired();
          reportedExpiration = true;
          state.finishing = true;
          state.done = true;
          reject(
            new DisplayableError(
              'server-refresh-required',
              'refresh series like state',
              'series ref'
            )
          );
          return;
        }

        const controller = new AbortController();
        const signal = controller.signal;
        const doAbort = () => controller.abort();
        state.cancelers.add(doAbort);
        if (state.finishing) {
          throw new Error('unexpected javascript engine yield leading to integrity error');
        }

        try {
          let response;
          try {
            response = await apiFetch(
              '/api/1/courses/search_public?course_jwt=' + encodeURIComponent(course.jwt),
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json; charset=utf-8',
                },
                body: JSON.stringify({ limit: 1 }),
                signal,
              },
              loginContext
            );
          } catch {
            throw new DisplayableError('connectivity', 'refresh series like state');
          }

          if (!response.ok) {
            throw chooseErrorFromStatus(response.status, 'refresh series like state');
          }

          if (state.finishing) {
            state.done = true;
            reject(
              new DisplayableError(
                'server-refresh-required',
                'refresh series like state',
                'series ref'
              )
            );
            return;
          }

          const data: { items: any[] } = await response.json();

          if (state.finishing) {
            state.done = true;
            reject(
              new DisplayableError(
                'server-refresh-required',
                'refresh series like state',
                'series ref'
              )
            );
            return;
          }

          if (data.items.length === 0) {
            state.finishing = true;
            setVWC(likedAtVWC, undefined);
            const err = new DisplayableError(
              'server-not-retryable',
              'refresh series like state',
              'series not found'
            );
            setVWC(errorVWC, err);
            state.done = true;
            reject(err);
            return;
          }

          const series = convertUsingMapper(data.items[0], externalCourseKeyMap);
          state.finishing = true;
          setVWC(likedAtVWC, series.likedAt);
          setVWC(errorVWC, null);
          state.done = true;
          resolve();
        } catch (e) {
          if (state.finishing) {
            state.done = true;
            reject(new DisplayableError('canceled', 'refresh series like state'));
            return;
          }

          const err =
            e instanceof DisplayableError
              ? e
              : new DisplayableError('client', 'refresh series like state', `${e}`);

          state.finishing = true;
          setVWC(errorVWC, err);
          state.done = true;
          reject(e);
        }
      },
    });
  };

  const like = (): CancelablePromise<void> => {
    return constructCancelablePromise({
      body: async (state, resolve, reject) => {
        if (reportedExpiration) {
          state.finishing = true;
          state.done = true;
          reject(new DisplayableError('server-refresh-required', 'like series', 'series ref'));
          return;
        }

        const loginContext = loginContextRaw.value.get();
        if (loginContext.state !== 'logged-in') {
          state.finishing = true;
          state.done = true;
          reject(new DisplayableError('server-refresh-required', 'like series', 'not logged in'));
          return;
        }

        const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
        canceled.promise.catch(() => {});
        if (state.finishing) {
          state.done = true;
          reject(new DisplayableError('canceled', 'like series'));
          canceled.cancel();
          return;
        }

        const serverNow = await getCurrentServerTimeMS();
        if (state.finishing) {
          state.done = true;
          reject(new DisplayableError('canceled', 'like series'));
          return;
        }

        if (jwtExpiresAt < serverNow) {
          reportExpired();
          reportedExpiration = true;
          state.finishing = true;
          state.done = true;
          reject(new DisplayableError('server-refresh-required', 'like series', 'series ref'));
          return;
        }

        const controller = new AbortController();
        const signal = controller.signal;
        const doAbort = () => controller.abort();
        state.cancelers.add(doAbort);
        if (state.finishing) {
          throw new Error('unexpected javascript engine yield leading to integrity error');
        }

        try {
          let response;
          try {
            response = await apiFetch(
              '/api/1/users/me/courses/likes',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json; charset=utf-8',
                },
                body: JSON.stringify({
                  uid: course.uid,
                  jwt: course.jwt,
                }),
                signal,
              },
              loginContext
            );
          } catch {
            throw new DisplayableError('connectivity', 'like series');
          }

          if (!response.ok) {
            throw chooseErrorFromStatus(response.status, 'like series');
          }

          if (state.finishing) {
            state.done = true;
            reject(new DisplayableError('canceled', 'like series'));
            return;
          }

          const data: { liked_at: number } = await response.json();

          if (state.finishing) {
            state.done = true;
            reject(new DisplayableError('canceled', 'like series'));
            return;
          }

          state.finishing = true;
          setVWC(likedAtVWC, new Date(data.liked_at * 1000));
          setVWC(showLikedUntilVWC, Date.now() + 5000);
          setVWC(showUnlikedUntilVWC, undefined);
          state.done = true;
          resolve();
        } catch (e) {
          if (state.finishing) {
            state.done = true;
            reject(new DisplayableError('canceled', 'like series'));
            return;
          }

          const err =
            e instanceof DisplayableError ? e : new DisplayableError('client', 'like', `${e}`);

          state.finishing = true;
          setVWC(errorVWC, err);
          state.done = true;
          reject(e);
        }
      },
    });
  };

  const unlike = (): CancelablePromise<void> => {
    return constructCancelablePromise({
      body: async (state, resolve, reject) => {
        if (reportedExpiration) {
          state.finishing = true;
          state.done = true;
          reject(new DisplayableError('server-refresh-required', 'unlike series', 'series ref'));
          return;
        }

        const loginContext = loginContextRaw.value.get();
        if (loginContext.state !== 'logged-in') {
          state.finishing = true;
          state.done = true;
          reject(new DisplayableError('server-refresh-required', 'unlike series', 'not logged in'));
          return;
        }

        const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
        canceled.promise.catch(() => {});
        if (state.finishing) {
          state.done = true;
          reject(new DisplayableError('canceled', 'unlike series'));
          canceled.cancel();
          return;
        }

        const serverNow = await getCurrentServerTimeMS();
        if (state.finishing) {
          state.done = true;
          reject(new DisplayableError('canceled', 'unlike series'));
          return;
        }

        if (jwtExpiresAt < serverNow) {
          reportExpired();
          reportedExpiration = true;
          state.finishing = true;
          state.done = true;
          reject(new DisplayableError('server-refresh-required', 'unlike series', 'series ref'));
          return;
        }

        const controller = new AbortController();
        const signal = controller.signal;
        const doAbort = () => controller.abort();
        state.cancelers.add(doAbort);
        if (state.finishing) {
          throw new Error('unexpected javascript engine yield leading to integrity error');
        }

        try {
          let response;
          try {
            response = await apiFetch(
              `/api/1/users/me/courses/likes?uid=${encodeURIComponent(
                course.uid
              )}&jwt=${encodeURIComponent(course.jwt)}`,
              {
                method: 'DELETE',
                signal,
              },
              loginContext
            );
          } catch {
            throw new DisplayableError('connectivity', 'unlike series');
          }

          if (!response.ok) {
            throw chooseErrorFromStatus(response.status, 'unlike series');
          }

          if (state.finishing) {
            state.done = true;
            reject(new DisplayableError('canceled', 'unlike series'));
            return;
          }

          state.finishing = true;
          setVWC(likedAtVWC, null);
          setVWC(showUnlikedUntilVWC, Date.now() + 5000);
          setVWC(showLikedUntilVWC, undefined);
          state.done = true;
          resolve();
        } catch (e) {
          if (state.finishing) {
            state.done = true;
            reject(new DisplayableError('canceled', 'unlike series'));
            return;
          }

          const err =
            e instanceof DisplayableError ? e : new DisplayableError('client', 'unlike', `${e}`);

          state.finishing = true;
          setVWC(errorVWC, err);
          state.done = true;
          reject(e);
        }
      },
    });
  };

  const toggleLike = (): CancelablePromise<void> => {
    const likedAt = likedAtVWC.get();
    if (likedAt === undefined) {
      return {
        promise: Promise.reject(
          new DisplayableError('client', 'toggle like', 'like status not loaded')
        ),
        done: () => true,
        cancel: () => {},
      };
    }

    if (likedAt === null) {
      return like();
    } else {
      return unlike();
    }
  };

  return {
    likedAt: likedAtVWC,
    showLikedUntil: showLikedUntilVWC,
    showUnlikedUntil: showUnlikedUntilVWC,
    error: errorVWC,
    refresh,
    like,
    unlike,
    toggleLike,
  };
};
