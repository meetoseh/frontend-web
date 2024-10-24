import { LoginContextValue, LoginContextValueLoggedIn } from '../contexts/LoginContext';
import { CancelablePromise } from './CancelablePromise';
import { constructCancelablePromise } from './CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from './createCancelablePromiseFromCallbacks';
import { DisplayableError } from './errors';
import { getCurrentServerTimeMS } from './getCurrentServerTimeMS';
import { getJwtExpiration } from './getJwtExpiration';
import { waitForValueWithCallbacksConditionCancelable } from './waitForValueWithCallbacksCondition';

/**
 * Creates a cancelable promise that resolves when the loginContext is in the
 * logged-in state, rejects when the loginContext is in the logged-out state
 * (or when canceled), and waits when the login context is in the loading state.
 */
export const getLoggedInUserCancelable = (
  loginContext: LoginContextValue,
  opts?: {
    minTimeUntilExpiredMS: number;
  }
): CancelablePromise<LoginContextValueLoggedIn> => {
  const minTimeUntilExpiredMS = opts?.minTimeUntilExpiredMS ?? 60000;
  return constructCancelablePromise({
    body: async (state, resolve, reject) => {
      const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
      canceled.promise.catch(() => {});
      if (state.finishing) {
        canceled.cancel();
        state.done = true;
        reject(new DisplayableError('canceled', 'get logged in user'));
        return;
      }

      const notLoading = waitForValueWithCallbacksConditionCancelable(
        loginContext.value,
        (s) => s.state !== 'loading'
      );
      notLoading.promise.catch(() => {});
      await Promise.race([notLoading.promise, canceled.promise]);
      if (state.finishing) {
        notLoading.cancel();
        canceled.cancel();
        state.done = true;
        reject(new DisplayableError('canceled', 'get logged in user'));
        return;
      }

      canceled.cancel();
      const finalState = await notLoading.promise;
      if (finalState.state !== 'logged-in') {
        state.finishing = true;
        state.done = true;
        reject(
          new DisplayableError('server-refresh-required', 'get logged in user', 'not logged in')
        );
        return;
      }

      const jwtExpiration = getJwtExpiration(finalState.authTokens.idToken);
      const serverNow = await getCurrentServerTimeMS();

      if (state.finishing) {
        state.done = true;
        reject(new DisplayableError('canceled', 'get logged in user'));
        return;
      }

      if (jwtExpiration + minTimeUntilExpiredMS < serverNow) {
        state.finishing = true;
        state.done = true;
        reject(
          new DisplayableError(
            'server-refresh-required',
            'get logged in user',
            'token is about to expire'
          )
        );
        return;
      }

      state.finishing = true;
      state.done = true;
      resolve(finalState);
    },
  });
};
