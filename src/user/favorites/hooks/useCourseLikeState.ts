import { useCallback, useContext, useEffect, useMemo } from 'react';
import {
  Callbacks,
  ValueWithCallbacks,
  ValueWithTypedCallbacks,
  WritableValueWithCallbacks,
  downgradeTypedVWC,
  useWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { Modals } from '../../../shared/contexts/ModalContext';
import {
  CancelablePromiseState,
  constructCancelablePromise,
} from '../../../shared/lib/CancelablePromiseConstructor';
import { apiFetch } from '../../../shared/ApiConstants';
import { CourseRef } from '../lib/CourseRef';
import { getCurrentServerTimeMS } from '../../../shared/lib/getCurrentServerTimeMS';
import { getJwtExpiration } from '../../../shared/lib/getJwtExpiration';
import { LoginContext, LoginContextValueLoggedIn } from '../../../shared/contexts/LoginContext';
import { convertUsingMapper } from '../../../admin/crud/CrudFetcher';
import { ExternalCourse, externalCourseKeyMap } from '../../series/lib/ExternalCourse';
import { createCancelablePromiseFromCallbacks } from '../../../shared/lib/createCancelablePromiseFromCallbacks';
import { setVWC } from '../../../shared/lib/setVWC';
import { useMappedValuesWithCallbacks } from '../../../shared/hooks/useMappedValuesWithCallbacks';
import { useFavoritedModal } from './useFavoritedModal';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { useUnfavoritedModal } from './useUnfavoritedModal';
import { DisplayableError } from '../../../shared/lib/errors';

export type UseCourseLikeStateProps = {
  /**
   * The course and proof of access. Changing this value will trigger a refresh if the
   * callback is invoked with undefined, or will set the likedAt to the given
   * value if the callback is invoked with a Date or null.
   */
  course:
    | ValueWithCallbacks<CourseRef>
    | ValueWithCallbacks<CourseRef | null | undefined>
    | ValueWithTypedCallbacks<CourseRef, Date | null | undefined>
    | ValueWithTypedCallbacks<CourseRef | null | undefined, Date | null | undefined>;

  /**
   * The modals context to use to display the liked / unliked modals
   */
  modals: WritableValueWithCallbacks<Modals>;

  /**
   * The initial value for when they liked the course. Only called when
   * remounted. If undefined, the liked status will be fetched from the server
   */
  initiallyLiked: () => Date | null | undefined;
};

export type UseCourseLikeStateResult = {
  /**
   * When the user last liked the course, null if the course is not
   * currently liked, undefined if still loading
   */
  likedAt: ValueWithCallbacks<Date | null | undefined>;
  /**
   * If an error occurred fetching the like status, this will be set to the
   * error message.
   */
  error: WritableValueWithCallbacks<DisplayableError | null>;
  /**
   * Refreshes the current liked status of the course. This will set
   * likedAt to undefined until the refresh is complete.
   */
  refresh: () => CancelablePromise<void>;
  /**
   * A function which can be called to try to like the course. Will immediately
   * fail if the course JWT is expired.
   */
  like: () => CancelablePromise<void>;
  /**
   * A function which can be called to try to unlike the course. Will immediately
   * fail if the course JWT is expired.
   */
  unlike: () => CancelablePromise<void>;
  /**
   * Convenience function for toggling the like status; errors immediately
   * if the current like status is not known
   */
  toggleLike: () => CancelablePromise<void>;
};

/**
 * Fetches the like status of a course, and provides functions to like or unlike
 * the course.
 */
export const useCourseLikeState = ({
  course: courseRefVWC,
  modals,
  initiallyLiked,
}: UseCourseLikeStateProps): UseCourseLikeStateResult => {
  const loginContextRaw = useContext(LoginContext);
  const likedAtVWC = useWritableValueWithCallbacks<
    { uid: string; value: Date | null } | null | undefined
  >(() => {
    const course = courseRefVWC.get();
    if (course === null || course === undefined) {
      return undefined;
    }

    const val = initiallyLiked();
    if (val === undefined) {
      return undefined;
    }
    return { uid: course.uid, value: val };
  });
  const error = useWritableValueWithCallbacks<DisplayableError | null>(() => null);

  const showingLikedUntil = useWritableValueWithCallbacks<number | undefined>(() => undefined);
  useFavoritedModal(adaptValueWithCallbacksAsVariableStrategyProps(showingLikedUntil));

  const showingUnlikedUntil = useWritableValueWithCallbacks<number | undefined>(() => undefined);
  useUnfavoritedModal(adaptValueWithCallbacksAsVariableStrategyProps(showingUnlikedUntil));

  // resolves to a meaningless value if state.finishing is true
  const handleCancelableStart = useCallback(
    async (
      state: CancelablePromiseState,
      reject: (e: any) => void
    ): Promise<{
      signal: AbortSignal | undefined;
      loginContext: LoginContextValueLoggedIn;
      courseRef: CourseRef;
    }> => {
      const controller = window.AbortController ? new AbortController() : undefined;
      const signal = controller?.signal;
      const doAbort = () => controller?.abort();
      state.cancelers.add(doAbort);
      if (state.finishing) {
        state.done = true;
        reject(new Error('canceled'));
        return { signal: undefined, loginContext: null as any, courseRef: null as any };
      }

      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        state.finishing = true;
        state.done = true;
        reject(new Error('not logged in'));
        return { signal: undefined, loginContext: null as any, courseRef: null as any };
      }

      const loginContext = loginContextUnch;

      const courseRefRaw = courseRefVWC.get();
      if (courseRefRaw === null || courseRefRaw === undefined) {
        state.finishing = true;
        state.done = true;
        reject(new Error('course not set'));
        return { signal: undefined, loginContext: null as any, courseRef: null as any };
      }
      const courseRef = courseRefRaw;
      const courseJWTExpiresAt = getJwtExpiration(courseRef.jwt);
      const currentServerTime = await getCurrentServerTimeMS();

      if (courseJWTExpiresAt < currentServerTime - 1000) {
        state.finishing = true;
        state.done = true;
        reject(new Error('course JWT expired'));
        return { signal: undefined, loginContext: null as any, courseRef: null as any };
      }

      return {
        signal,
        loginContext,
        courseRef,
      };
    },
    [loginContextRaw, courseRefVWC]
  );

  const handleCancelableError = useCallback(
    async (
      state: CancelablePromiseState,
      resolve: () => void,
      reject: (e: any) => void,
      e: any
    ) => {
      const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
      canceled.promise.catch(() => {});
      if (state.finishing) {
        canceled.cancel();
        state.done = true;
        reject(e);
        return;
      }
      const err =
        e instanceof DisplayableError
          ? e
          : new DisplayableError('client', 'update if course is liked', `${e}`);
      if (state.finishing) {
        state.done = true;
        reject(e);
        return;
      }

      state.finishing = true;
      setVWC(error, err);
      setVWC(likedAtVWC, null);
      state.done = true;
      resolve();
    },
    [error, likedAtVWC]
  );

  const getLikedAtFromServer = useCallback(
    (): CancelablePromise<{ uid: string; value: Date | null }> =>
      constructCancelablePromise({
        body: async (state, resolve, reject) => {
          const { signal, loginContext, courseRef } = await handleCancelableStart(state, reject);
          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          let response: Response;
          try {
            response = await apiFetch(
              '/api/1/courses/search_public?course_jwt=' + encodeURIComponent(courseRef.jwt),
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                signal,
                body: JSON.stringify({
                  limit: 1,
                }),
              },
              loginContext
            );
          } catch (e) {
            state.finishing = true;
            state.done = true;
            reject(e);
            return;
          }

          if (!response.ok) {
            state.finishing = true;
            state.done = true;
            reject(response);
            return;
          }

          let course: ExternalCourse;
          try {
            const data: { items: any[] } = await response.json();
            if (data.items.length === 0) {
              reject(new Error('course not found'));
            }
            course = convertUsingMapper(data.items[0], externalCourseKeyMap);
          } catch (e) {
            state.finishing = true;
            state.done = true;
            reject(e);
            return;
          }

          state.finishing = true;
          state.done = true;
          resolve({ uid: course.uid, value: course.likedAt });
        },
      }),
    [handleCancelableStart]
  );

  const refresh = useCallback(
    (): CancelablePromise<void> =>
      constructCancelablePromise({
        body: async (state, resolve, reject) => {
          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          const inner = getLikedAtFromServer();
          state.cancelers.add(inner.cancel);
          if (state.finishing) {
            inner.cancel();
          }
          let likedAt: { uid: string; value: Date | null };
          try {
            likedAt = await inner.promise;
          } catch (e) {
            return await handleCancelableError(state, resolve, reject, e);
          }
          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }
          state.finishing = true;
          setVWC(error, null);
          setVWC(likedAtVWC, likedAt);
          state.done = true;
          resolve();
        },
      }),
    [getLikedAtFromServer, error, likedAtVWC, handleCancelableError]
  );

  const like = useCallback(
    (): CancelablePromise<void> =>
      constructCancelablePromise({
        body: async (state, resolve, reject) => {
          const { signal, loginContext, courseRef } = await handleCancelableStart(state, reject);
          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          try {
            const response = await apiFetch(
              '/api/1/users/me/courses/likes',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                signal,
                body: JSON.stringify(courseRef),
              },
              loginContext
            );
            if (!response.ok) {
              throw response;
            }
            const data: { liked_at: number } = await response.json();
            if (state.finishing) {
              state.done = true;
              reject(new Error('canceled'));
              return;
            }
            state.finishing = true;
            setVWC(error, null);
            setVWC(likedAtVWC, { uid: courseRef.uid, value: new Date(data.liked_at * 1000) });
            setVWC(showingUnlikedUntil, undefined);
            setVWC(showingLikedUntil, Date.now() + 5000);
            state.done = true;
            resolve();
          } catch (e) {
            return await handleCancelableError(state, resolve, reject, e);
          }
        },
      }),
    [
      error,
      handleCancelableError,
      handleCancelableStart,
      likedAtVWC,
      showingLikedUntil,
      showingUnlikedUntil,
    ]
  );
  const unlike = useCallback(
    (): CancelablePromise<void> =>
      constructCancelablePromise({
        body: async (state, resolve, reject) => {
          const { signal, loginContext, courseRef } = await handleCancelableStart(state, reject);
          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          try {
            const response = await apiFetch(
              '/api/1/users/me/courses/likes?' +
                new URLSearchParams({ uid: courseRef.uid, jwt: courseRef.jwt }).toString(),
              {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                signal,
              },
              loginContext
            );
            if (!response.ok) {
              throw response;
            }
            if (state.finishing) {
              state.done = true;
              reject(new Error('canceled'));
              return;
            }
            state.finishing = true;
            setVWC(error, null);
            setVWC(likedAtVWC, { uid: courseRef.uid, value: null });
            setVWC(showingUnlikedUntil, Date.now() + 5000);
            setVWC(showingLikedUntil, undefined);
            state.done = true;
            resolve();
          } catch (e) {
            return await handleCancelableError(state, resolve, reject, e);
          }
        },
      }),
    [
      error,
      handleCancelableError,
      handleCancelableStart,
      likedAtVWC,
      showingLikedUntil,
      showingUnlikedUntil,
    ]
  );
  const toggleLike = useCallback((): CancelablePromise<void> => {
    const likedAt = likedAtVWC.get();
    if (likedAt === undefined) {
      throw new Error('like status not known');
    }

    if (likedAt === null || likedAt.value === null) {
      return like();
    } else {
      return unlike();
    }
  }, [like, unlike, likedAtVWC]);

  useEffect(() => {
    courseRefVWC.callbacks.add(onRefChanged);
    let active = true;
    let changedCounter = 0;
    const cancelers = new Callbacks<undefined>();
    onRefChanged(initiallyLiked());

    return () => {
      active = false;
      courseRefVWC.callbacks.remove(onRefChanged);
      cancelers.call(undefined);
    };

    async function onRefChanged(v: Date | null | undefined) {
      const id = ++changedCounter;
      if (!active || changedCounter !== id) {
        return;
      }

      const courseRefRaw = courseRefVWC.get();
      if (courseRefRaw === null || courseRefRaw === undefined) {
        setVWC(likedAtVWC, undefined);
        return;
      }
      const courseRef = courseRefRaw;

      if (v !== undefined) {
        setVWC(likedAtVWC, { uid: courseRef.uid, value: v });
      } else {
        const likedAt = likedAtVWC.get();
        if (likedAt !== null && likedAt !== undefined && likedAt.uid === courseRef.uid) {
          return;
        }

        const refreshCancelable = refresh();
        cancelers.add(refreshCancelable.cancel);
        courseRefVWC.callbacks.add(refreshCancelable.cancel);
        if (!active || id !== changedCounter) {
          refreshCancelable.cancel();
        }

        try {
          await refreshCancelable.promise;
        } catch (e) {
          if (active && id === changedCounter) {
            console.error(e);
          }
        } finally {
          cancelers.remove(refreshCancelable.cancel);
          courseRefVWC.callbacks.remove(refreshCancelable.cancel);
        }
      }
    }
  }, [courseRefVWC, likedAtVWC, refresh, initiallyLiked]);

  const mappedLikedAtVWC = useMappedValuesWithCallbacks(
    [likedAtVWC, downgradeTypedVWC(courseRefVWC)],
    () => {
      const likedAt = likedAtVWC.get();
      const course = courseRefVWC.get();

      if (likedAt === undefined || course === null || course === undefined) {
        return undefined;
      }

      if (likedAt === null) {
        return null;
      }

      if (likedAt.uid !== course.uid) {
        return undefined;
      }

      return likedAt.value;
    }
  );

  return useMemo(
    () => ({
      likedAt: mappedLikedAtVWC,
      error,
      refresh,
      like,
      unlike,
      toggleLike,
    }),
    [error, refresh, like, unlike, toggleLike, mappedLikedAtVWC]
  );
};
