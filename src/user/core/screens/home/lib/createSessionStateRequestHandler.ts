import {
  ValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../../shared/lib/CancelablePromise';
import { LoginContextValueLoggedIn } from '../../../../../shared/contexts/LoginContext';
import { RequestHandler, Result } from '../../../../../shared/requests/RequestHandler';
import { mapCancelable } from '../../../../../shared/lib/mapCancelable';
import { describeError } from '../../../../../shared/forms/ErrorBlock';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import { constructCancelablePromise } from '../../../../../shared/lib/CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from '../../../../../shared/lib/createCancelablePromiseFromCallbacks';
import { getCurrentServerTimeMS } from '../../../../../shared/lib/getCurrentServerTimeMS';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { createValueWithCallbacksEffect } from '../../../../../shared/hooks/createValueWithCallbacksEffect';

/** A snapshot for a session state, usually used for other resources */
export type SessionStateSnapshot = {
  /** A recent logged in state */
  loginContext: LoginContextValueLoggedIn;
  /** True if they've taken a class this session, false otherwise */
  takenAClass: boolean;
};

export type SessionState = {
  /**
   * When this session began and the most recent time there was activity, or
   * null if they are not in an active session.
   */
  activity: ValueWithCallbacks<{ first: Date; last: Date } | null>;

  /** True if they've taken a class this session, false otherwise */
  takenAClass: ValueWithCallbacks<boolean>;

  /** Updates the session state from the network. We treat errors like a fresh session */
  refresh: () => CancelablePromise<void>;

  /** Clears the state without a network call */
  reset: () => void;

  /** Clears activity after an expiration period. Returns the cleanup handler. */
  manageResets: () => () => void;

  /** Snapshots this session info to be used as a ref for another request handler */
  snapshot: (mostRecentRef: LoginContextValueLoggedIn) => SessionStateSnapshot;

  /** Tracks locally that a class was started */
  onClassTaken: () => void;
};

const SESSION_TIME_SECONDS = 60 * 60 * 2;

/**
 * Creates a request handler which tracks the state of the logged in users session.
 */
export const createSessionStateRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<LoginContextValueLoggedIn, SessionState> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: LoginContextValueLoggedIn): string => ref.userAttributes.sub;
const getDataFromRef = (
  ref: LoginContextValueLoggedIn
): CancelablePromise<Result<SessionState>> => {
  const state = createSessionState({ loginContext: ref });

  return mapCancelable(
    state.refresh(),
    (): Result<SessionState> => ({
      type: 'success',
      data: state,
      error: undefined,
      retryAt: undefined,
    }),
    async (e, state, resolve, reject) => {
      const err = await describeError(e);
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
const compareRefs = (a: LoginContextValueLoggedIn, b: LoginContextValueLoggedIn): number =>
  getJwtExpiration(b.authTokens.idToken) - getJwtExpiration(a.authTokens.idToken);

/**
 * Creates an object that tracks and mutates the recent activity of the logged in user.
 */
export const createSessionState = ({
  loginContext,
}: {
  loginContext: LoginContextValueLoggedIn;
}): SessionState => {
  let reportedExpiration = false;
  const jwtExpiresAt = getJwtExpiration(loginContext.authTokens.idToken);
  const activityVWC = createWritableValueWithCallbacks<{ first: Date; last: Date } | null>(null);
  const takenAClassVWC = createWritableValueWithCallbacks(false);

  const refresh = (): CancelablePromise<void> => {
    return constructCancelablePromise({
      body: async (state, resolve, reject) => {
        if (reportedExpiration) {
          state.finishing = true;
          state.done = true;
          reject(new Error('this SessionState has expired'));
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
          reportedExpiration = true;
          state.finishing = true;
          state.done = true;
          reject(new Error('this SessionState has just expired'));
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
          const response = await apiFetch(
            '/api/1/users/me/search_history',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
              },
              body: JSON.stringify({
                filters: {
                  last_taken_at: {
                    operator: 'gt',
                    value: serverNow / 1000 - SESSION_TIME_SECONDS,
                  },
                },
                sort: [{ key: 'last_taken_at', dir: 'desc', before: null, after: null }],
                limit: 1,
              }),
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

          const data: { items: any[] } = await response.json();

          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          if (data.items.length === 0) {
            state.finishing = true;
            setVWC(activityVWC, null);
            setVWC(takenAClassVWC, false);
            state.done = true;
            resolve();
            return;
          }

          const lastTakenAtRaw = data.items[0].last_taken_at as number | null | undefined;
          const lastTakenAt =
            lastTakenAtRaw === null || lastTakenAtRaw === undefined
              ? null
              : new Date(lastTakenAtRaw * 1000);
          state.finishing = true;
          if (lastTakenAt === null) {
            setVWC(activityVWC, null);
            setVWC(takenAClassVWC, false);
          } else {
            setVWC(activityVWC, { first: lastTakenAt, last: lastTakenAt });
            setVWC(takenAClassVWC, true);
          }
          state.done = true;
          resolve();
        } catch (e) {
          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          state.finishing = true;
          setVWC(activityVWC, null);
          setVWC(takenAClassVWC, false);
          state.done = true;
          resolve();
        }
      },
    });
  };

  const reset = () => {
    setVWC(activityVWC, null);
    setVWC(takenAClassVWC, false);
  };

  const manageResets = (): (() => void) => {
    return createValueWithCallbacksEffect(activityVWC, (activityRaw) => {
      if (activityRaw === null) {
        return undefined;
      }
      const activity = activityRaw;
      let active = true;
      let timeout: NodeJS.Timeout | null = null;
      setupTimer();
      return () => {
        active = false;
        if (timeout !== null) {
          clearTimeout(timeout);
          timeout = null;
        }
      };

      async function setupTimer() {
        if (!active) {
          return;
        }
        const nowServer = await getCurrentServerTimeMS();
        if (!active) {
          return;
        }
        const lastTakenAtMS = activity.last.getTime();
        const expiresAtMS = lastTakenAtMS + SESSION_TIME_SECONDS * 1000;
        timeout = setTimeout(() => {
          timeout = null;
          if (!active) {
            return;
          }
          reset();
        }, Math.max(0, expiresAtMS - nowServer));
      }
    });
  };

  return {
    activity: activityVWC,
    takenAClass: takenAClassVWC,
    refresh,
    reset,
    manageResets,
    snapshot: (loginContext) => ({
      loginContext,
      takenAClass: takenAClassVWC.get(),
    }),
    onClassTaken: async () => {
      const nowMS = await getCurrentServerTimeMS();
      const now = new Date(nowMS);
      const oldActivity = activityVWC.get();
      if (oldActivity === null) {
        setVWC(activityVWC, { first: now, last: now });
      } else {
        setVWC(activityVWC, { first: oldActivity.first, last: now });
      }
      setVWC(takenAClassVWC, true);
    },
  };
};
