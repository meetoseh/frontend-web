import { CancelablePromise } from './CancelablePromise';
import { CancelablePromiseState, constructCancelablePromise } from './CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from './createCancelablePromiseFromCallbacks';

/**
 * Returns a new cancelable which waits until the provided one resolves,
 * then runs the synchronous mapper function on the result and resolves
 * with the result of that.
 */
export function mapCancelable<T, U>(
  base: CancelablePromise<U>,
  mapper: (u: U) => T,
  rejectHandler?: (
    e: any,
    state: CancelablePromiseState,
    resolve: (t: T) => void,
    reject: (e: any) => void
  ) => Promise<void>
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
        await Promise.race([canceled.promise, base.promise]);
      } catch (e) {
        if (state.finishing) {
          state.done = true;
          reject(new Error('canceled'));
          return;
        }

        if (rejectHandler !== undefined) {
          return rejectHandler(e, state, resolve, reject);
        }

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
      // and Promise.race didn't reject (or we would have returned), base.promise
      // must have resolved
      const u = await base.promise;

      // however, awaiting still delayed us either a microtask or full task, and thus
      // we might have been canceled in the meantime
      if (state.finishing) {
        state.done = true;
        reject(new Error('canceled'));
        return;
      }

      try {
        const res = mapper(u);
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
