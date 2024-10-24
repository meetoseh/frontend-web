import { WritableValueWithCallbacks } from './Callbacks';

/**
 * Constantly sets the given message vwc to null (to indicate the message was processed)
 * until it's been empty for a while.
 *
 * Generally, this only makes sense when cleaning up the receiver side of a
 * `receiveMessageWithVWC`/`passMessageWithVWC` pair before shutting down
 * the receive queue.
 *
 * This is more defensive than should be necessary since we almost never
 * purposely queue multiple messages at once as it's rarely helpful, but if we
 * do so and we don't clean it up this way AND the pass message side is not
 * canceled, then we leak a coroutine which is pretty bad.
 */
export const clearMessagesWithVWC = async <T extends {} | undefined>(
  messageVWC: WritableValueWithCallbacks<T | null>
) => {
  let streak = 0;
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 1));
    if (messageVWC.get() === null) {
      streak = streak + 1;
      if (streak > 5) {
        break;
      }
    }
    streak = 0;
    messageVWC.set(null);
    messageVWC.callbacks.call(undefined);
  }
};
