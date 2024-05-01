import { CancelablePromise } from './CancelablePromise';
import { constructCancelablePromise } from './CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from './createCancelablePromiseFromCallbacks';

/**
 * Constructs a new cancelable which waits until resolves (rejecting if
 * until rejects) before creating another underyling cancelable with the
 * result of `until`
 */
export function delayCancelableUntilResolved<T, U>(
  cancelable: (u: U) => CancelablePromise<T>,
  until: CancelablePromise<U>
): CancelablePromise<T> {
  return constructCancelablePromise({
    body: async (state, resolve, reject) => {
      const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
      canceled.promise.catch(() => {});
      if (state.finishing) {
        canceled.cancel();
        state.done = true;
        reject(new Error('canceled'));
        return;
      }

      try {
        await Promise.race([canceled.promise, until.promise]);
      } catch (e) {
        state.finishing = true;
        state.done = true;
        reject(e);
        return;
      }

      if (state.finishing) {
        state.done = true;
        reject(new Error('canceled'));
        return;
      }

      canceled.cancel();

      // since canceled.promise didn't resolve (or state.finishing would be set),
      // and Promise.race didn't reject (or we would have returned), until.promise
      // must have resolved
      const u = await until.promise;

      // however, awaiting still delayed us either a microtask or full task, and thus
      // we might have been canceled in the meantime
      if (state.finishing) {
        state.done = true;
        reject(new Error('canceled'));
        return;
      }

      try {
        const underlying = cancelable(u);
        state.cancelers.add(underlying.cancel);
        if (state.finishing) {
          underlying.cancel();
        }
        const res = await underlying.promise;
        state.finishing = true;
        state.done = true;
        resolve(res);
      } catch (e) {
        state.finishing = true;
        state.done = true;
        reject(e);
      }
    },
  });
}
