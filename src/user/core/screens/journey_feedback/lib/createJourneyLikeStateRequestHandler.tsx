import {
  ValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../../shared/lib/CancelablePromise';
import { LoginContextValue } from '../../../../../shared/contexts/LoginContext';
import { RequestHandler, Result } from '../../../../../shared/requests/RequestHandler';
import { ExpirableJourneyRef } from './ExpirableJourneyRef';
import { mapCancelable } from '../../../../../shared/lib/mapCancelable';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import { JourneyRef } from '../../../../journey/models/JourneyRef';
import { constructCancelablePromise } from '../../../../../shared/lib/CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from '../../../../../shared/lib/createCancelablePromiseFromCallbacks';
import { getCurrentServerTimeMS } from '../../../../../shared/lib/getCurrentServerTimeMS';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { chooseErrorFromStatus, DisplayableError } from '../../../../../shared/lib/errors';

export type JourneyLikeState = {
  /**
   * When the user last liked the journey, null if the journey is not
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
   * Describes the last error that occurred, if any.
   */
  error: ValueWithCallbacks<DisplayableError | null>;

  /**
   * Refreshes the current liked status of the journey. This will set
   * likedAt to undefined until the refresh is complete. Errors immediately
   * if the journey JWT is expired.
   */
  refresh: () => CancelablePromise<void>;
  /**
   * A function which can be called to try to like the journey. Will reject
   * if the journey JWT is expired.
   */
  like: () => CancelablePromise<void>;
  /**
   * A function which can be called to try to unlike the journey. Will reject
   * if the journey JWT is expired.
   */
  unlike: () => CancelablePromise<void>;
  /**
   * Convenience function for toggling the like status; rejects if the journey
   * JWT is expired.
   */
  toggleLike: () => CancelablePromise<void>;
};

/**
 * Creates a request handler which accepts journey refs and returns mutable
 * like states for those journeys. A request handler is in many ways overkill
 * for this, but given its available it's a convenient way to manage ownership
 *
 * Normally the request handler abstraction would avoid the need for explicitly
 * passing the reportExpired function in the ref like this, but since
 * JourneyLikeState is itself mutable we may try to use the reference outside of
 * the request handlers handling of the ref, and hence e.g. createChainedRequest
 * wouldn't be able to detect all the possible times we might try to use the ref.
 */
export const createJourneyLikeStateRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
  loginContextRaw,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
  loginContextRaw: LoginContextValue;
}): RequestHandler<{ journey: { uid: string } }, ExpirableJourneyRef, JourneyLikeState> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef: getDataFromRef(loginContextRaw),
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: { journey: { uid: string } }): string => ref.journey.uid;
const getDataFromRef = (
  loginContextRaw: LoginContextValue
): ((ref: ExpirableJourneyRef) => CancelablePromise<Result<JourneyLikeState>>) => {
  return (ref) => {
    const state = createJourneyLikeState({
      loginContextRaw,
      journey: ref.journey,
      reportExpired: ref.reportExpired,
    });

    return mapCancelable(
      state.refresh(),
      (): Result<JourneyLikeState> => ({
        type: 'success',
        data: state,
        error: undefined,
        retryAt: undefined,
      }),
      async (e, state, resolve, reject) => {
        const err =
          e instanceof DisplayableError
            ? e
            : new DisplayableError('client', 'fetch journey like state', `${e}`);
        if (state.finishing) {
          state.done = true;
          reject(new Error('canceled'));
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
const compareRefs = (a: ExpirableJourneyRef, b: ExpirableJourneyRef): number =>
  getJwtExpiration(b.journey.jwt) - getJwtExpiration(a.journey.jwt);

/**
 * Creates an object that tracks and mutates if the given journey is liked by the
 * logged in user. This does not refresh immediately, so the caller should call
 * refresh() to initialize the state.
 */
export const createJourneyLikeState = ({
  loginContextRaw,
  journey,
  reportExpired,
}: {
  loginContextRaw: LoginContextValue;
  journey: Pick<JourneyRef, 'uid' | 'jwt'>;
  reportExpired: () => void;
}): JourneyLikeState => {
  let reportedExpiration = false;
  const jwtExpiresAt = getJwtExpiration(journey.jwt);

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
          reject(new Error('this JourneyLikeState has expired'));
          return;
        }

        const loginContext = loginContextRaw.value.get();
        if (loginContext.state !== 'logged-in') {
          state.finishing = true;
          state.done = true;
          reject(new Error('not logged in'));
          return;
        }

        const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
        canceled.promise.catch(() => {});
        if (state.finishing) {
          state.done = true;
          reject(new Error('canceled'));
          canceled.cancel();
          return;
        }

        const serverNow = await getCurrentServerTimeMS();
        if (state.finishing) {
          state.done = true;
          reject(new Error('canceled'));
          return;
        }

        if (jwtExpiresAt < serverNow) {
          reportExpired();
          reportedExpiration = true;
          state.finishing = true;
          state.done = true;
          reject(new Error('this JourneyLikeState has just expired'));
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
              '/api/1/users/me/search_history',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json; charset=utf-8',
                },
                body: JSON.stringify({
                  filters: {
                    uid: {
                      operator: 'eq',
                      value: journey.uid,
                    },
                  },
                  limit: 1,
                }),
                signal,
              },
              loginContext
            );
          } catch {
            throw new DisplayableError('connectivity', 'refresh like state');
          }

          if (!response.ok) {
            throw chooseErrorFromStatus(response.status, 'refresh like state');
          }

          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          const data: { items: any[] } = await response.json();

          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          if (data.items.length === 0) {
            state.finishing = true;
            setVWC(likedAtVWC, null);
            setVWC(errorVWC, null);
            state.done = true;
            resolve();
            return;
          }

          const likedAtRaw = data.items[0].liked_at as number | null | undefined;
          const likedAt =
            likedAtRaw === null || likedAtRaw === undefined ? null : new Date(likedAtRaw * 1000);
          state.finishing = true;
          setVWC(likedAtVWC, likedAt);
          setVWC(errorVWC, null);
          state.done = true;
          resolve();
        } catch (e) {
          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          const err =
            e instanceof DisplayableError
              ? e
              : new DisplayableError('client', 'refresh like state', `${e}`);
          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

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
          reject(new DisplayableError('server-refresh-required', 'like journey', 'journey ref'));
          return;
        }

        const loginContext = loginContextRaw.value.get();
        if (loginContext.state !== 'logged-in') {
          state.finishing = true;
          state.done = true;
          reject(new DisplayableError('server-refresh-required', 'like journey', 'not logged in'));
          return;
        }

        const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
        canceled.promise.catch(() => {});
        if (state.finishing) {
          state.done = true;
          reject(new DisplayableError('canceled', 'like journey'));
          canceled.cancel();
          return;
        }

        const serverNow = await getCurrentServerTimeMS();
        if (state.finishing) {
          state.done = true;
          reject(new DisplayableError('canceled', 'like journey'));
          return;
        }

        if (jwtExpiresAt < serverNow) {
          reportExpired();
          reportedExpiration = true;
          state.finishing = true;
          state.done = true;
          reject(new DisplayableError('server-refresh-required', 'like journey', 'journey ref'));
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
              '/api/1/users/me/journeys/likes',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json; charset=utf-8',
                },
                body: JSON.stringify({
                  journey_uid: journey.uid,
                }),
                signal,
              },
              loginContext
            );
          } catch {
            throw new DisplayableError('connectivity', 'like journey');
          }

          if (!response.ok) {
            throw chooseErrorFromStatus(response.status, 'like journey');
          }

          if (state.finishing) {
            state.done = true;
            reject(new DisplayableError('canceled', 'like journey'));
            return;
          }

          const likedAt = await (async () => {
            if (response.status === 204) {
              return new Date();
            }
            const data: { liked_at: number } = await response.json();
            return new Date(data.liked_at * 1000);
          })();

          if (state.finishing) {
            state.done = true;
            reject(new DisplayableError('canceled', 'like journey'));
            return;
          }

          state.finishing = true;
          setVWC(likedAtVWC, likedAt);
          setVWC(showLikedUntilVWC, Date.now() + 5000);
          setVWC(showUnlikedUntilVWC, undefined);
          state.done = true;
          resolve();
        } catch (e) {
          if (state.finishing) {
            state.done = true;
            reject(new DisplayableError('canceled', 'like journey'));
            return;
          }

          const err =
            e instanceof DisplayableError
              ? e
              : new DisplayableError('client', 'like journey', `${e}`);

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
          reject(new DisplayableError('server-refresh-required', 'unlike journey', 'journey ref'));
          return;
        }

        const loginContext = loginContextRaw.value.get();
        if (loginContext.state !== 'logged-in') {
          state.finishing = true;
          state.done = true;
          reject(
            new DisplayableError('server-refresh-required', 'unlike journey', 'not logged in')
          );
          return;
        }

        const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
        canceled.promise.catch(() => {});
        if (state.finishing) {
          state.done = true;
          reject(new DisplayableError('canceled', 'unlike journey'));
          canceled.cancel();
          return;
        }

        const serverNow = await getCurrentServerTimeMS();
        if (state.finishing) {
          state.done = true;
          reject(new DisplayableError('canceled', 'unlike journey'));
          return;
        }

        if (jwtExpiresAt < serverNow) {
          reportExpired();
          reportedExpiration = true;
          state.finishing = true;
          state.done = true;
          reject(new DisplayableError('server-refresh-required', 'unlike journey', 'journey ref'));
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
              `/api/1/users/me/journeys/likes?uid=${encodeURIComponent(journey.uid)}`,
              {
                method: 'DELETE',
                signal,
              },
              loginContext
            );
          } catch {
            throw new DisplayableError('connectivity', 'unlike journey');
          }

          if (!response.ok) {
            throw chooseErrorFromStatus(response.status, 'unlike journey');
          }

          if (state.finishing) {
            state.done = true;
            reject(new DisplayableError('canceled', 'unlike journey'));
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
            reject(new DisplayableError('canceled', 'unlike journey'));
            return;
          }

          const err =
            e instanceof DisplayableError
              ? e
              : new DisplayableError('client', 'unlike journey', `${e}`);
          if (state.finishing) {
            state.done = true;
            reject(new DisplayableError('canceled', 'unlike journey'));
            return;
          }

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
        promise: Promise.reject(new DisplayableError('client', 'toggle like', 'not loaded')),
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
