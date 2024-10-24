import { WritableValueWithCallbacks } from './Callbacks';
import { CancelablePromise } from './CancelablePromise';
import { constructCancelablePromise } from './CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from './createCancelablePromiseFromCallbacks';
import { waitForValueWithCallbacksConditionCancelable } from './waitForValueWithCallbacksCondition';

/**
 * Assuming that there is a reader coroutine that will take values
 * within `messageVWC` and then set it to null, this function will
 * construct a cancelable promise that will wait until the messageVWC
 * is null, then set it to the message, then wait until the messageVWC
 * is null again.
 * @see receiveMessageWithVWC
 */
export const passMessageWithVWC = <T extends {} | undefined>(
  messageVWC: WritableValueWithCallbacks<T | null>,
  message: T
): CancelablePromise<void> =>
  constructCancelablePromise({
    body: async (state, resolve, reject) => {
      const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
      canceled.promise.catch(() => {});

      let assigned = false;
      while (true) {
        if (state.finishing) {
          canceled.cancel();
          state.done = true;
          reject(new Error('canceled'));
          return;
        }

        if (messageVWC.get() === null) {
          if (assigned) {
            canceled.cancel();
            state.finishing = true;
            state.done = true;
            resolve();
            return;
          }

          messageVWC.set(message);
          messageVWC.callbacks.call(undefined);
          assigned = true;
        }

        const messageIsNull = waitForValueWithCallbacksConditionCancelable(
          messageVWC,
          (v) => v === null
        );
        messageIsNull.promise.catch(() => {});
        await Promise.race([messageIsNull.promise, canceled.promise]);
        messageIsNull.cancel();
      }
    },
  });
