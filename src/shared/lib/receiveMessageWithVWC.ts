import { WritableValueWithCallbacks } from './Callbacks';
import { CancelablePromise } from './CancelablePromise';
import { constructCancelablePromise } from './CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from './createCancelablePromiseFromCallbacks';
import { waitForValueWithCallbacksConditionCancelable } from './waitForValueWithCallbacksCondition';

/**
 * Assuming that there is a write coroutine that will write values to
 * `messageVWC`, this function will construct a cancelable promise that will
 * wait until the messageVWC is not null null and return a function that
 * will set it to null and return the value.
 *
 * If this promise resolves but you don't call the returned callback then
 * it doesn't change the state, which is convenient for cleanup with Promise.race
 * (if something else happened in the same event loop, you can cancel this without
 * checking if it already finished)
 *
 * @see passMessageWithVWC
 */
export const receiveMessageWithVWC = <T extends {} | undefined>(
  messageVWC: WritableValueWithCallbacks<T | null>
): CancelablePromise<() => T> =>
  constructCancelablePromise({
    body: async (state, resolve, reject) => {
      const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
      canceled.promise.catch(() => {});

      while (true) {
        if (state.finishing) {
          canceled.cancel();
          state.done = true;
          reject(new Error('canceled'));
          return;
        }

        if (messageVWC.get() !== null) {
          canceled.cancel();
          state.finishing = true;
          state.done = true;
          resolve(() => {
            const value = messageVWC.get();
            if (value === null) {
              throw new Error('value was stolen');
            }
            messageVWC.set(null);
            messageVWC.callbacks.call(undefined);
            return value;
          });
          return;
        }

        const messageIsNotNull = waitForValueWithCallbacksConditionCancelable(
          messageVWC,
          (v) => v !== null
        );
        messageIsNotNull.promise.catch(() => {});
        await Promise.race([messageIsNotNull.promise, canceled.promise]);
        messageIsNotNull.cancel();
      }
    },
  });
