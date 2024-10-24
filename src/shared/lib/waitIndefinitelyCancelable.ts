import { CancelablePromise } from './CancelablePromise';
import { constructCancelablePromise } from './CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from './createCancelablePromiseFromCallbacks';
import { DisplayableError } from './errors';

export const waitIndefinitelyCancelable = <T>(): CancelablePromise<T> =>
  constructCancelablePromise({
    body: async (state, resolve, reject) => {
      const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
      canceled.promise.catch(() => {});
      if (state.finishing) {
        canceled.cancel();
        state.done = true;
        reject(new DisplayableError('canceled', 'wait indefinitely'));
        return;
      }

      await canceled.promise;
      state.finishing = true;
      state.done = true;
      reject(new DisplayableError('canceled', 'wait indefinitely'));
    },
  });
