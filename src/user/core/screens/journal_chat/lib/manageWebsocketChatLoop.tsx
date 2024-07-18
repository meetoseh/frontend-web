import { HTTP_WEBSOCKET_URL } from '../../../../../shared/ApiConstants';
import { WrappedJournalClientKey } from '../../../../../shared/journals/clientKeys';
import {
  createWritableValueWithCallbacks,
  WritableValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../../shared/lib/CancelablePromise';
import { constructCancelablePromise } from '../../../../../shared/lib/CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from '../../../../../shared/lib/createCancelablePromiseFromCallbacks';
import { createCancelableTimeout } from '../../../../../shared/lib/createCancelableTimeout';
import { getCurrentServerTimeMS } from '../../../../../shared/lib/getCurrentServerTimeMS';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { waitForValueWithCallbacksConditionCancelable } from '../../../../../shared/lib/waitForValueWithCallbacksCondition';
import { computeJournalChatStateDataIntegrity, JournalChatState } from './JournalChatState';

/**
 * Connects to `WS /api/2/journals/chat` and reads the journal chat state
 * that it sends over, resolving only once the journal chat is in a final
 * state. This will manage retries.
 */
export const manageWebsocketChatLoop = (params: {
  clientKey: WrappedJournalClientKey;
  out: WritableValueWithCallbacks<JournalChatState>;
  journalChatJWT: string;
  journalEntryUID: string;
}): CancelablePromise<void> => {
  return constructCancelablePromise({
    body: async (state, resolve, reject) => {
      let recentRetriesAt: number[] = [];
      while (true) {
        const inner = manageWebsocketChatLoopWithoutRetries(params);
        state.cancelers.add(inner.cancel);
        try {
          if (state.finishing) {
            inner.cancel();
          }
          let result: Awaited<typeof inner.promise>;
          try {
            result = await inner.promise;
          } catch (e) {
            state.finishing = true;
            state.done = true;
            reject(e);
            return;
          }
          if (result === 'success') {
            state.finishing = true;
            state.done = true;
            resolve();
            return;
          }

          if (result !== 'failed-retryable') {
            throw new Error('unexpected result');
          }

          const now = Date.now();
          recentRetriesAt = recentRetriesAt.filter((at) => at > now - 1000 * 300);
          recentRetriesAt.push(now);

          if (recentRetriesAt.length >= 5) {
            state.finishing = true;
            state.done = true;
            reject(new Error('too many retries'));
            return;
          }

          const backoffMs =
            1000 * Math.pow(2, recentRetriesAt.length) * (Math.random() * 1.5 + 0.5);
          const timeout = createCancelableTimeout(backoffMs);
          const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
          canceled.promise.catch(() => {});
          if (state.finishing) {
            canceled.cancel();
          }
          try {
            await Promise.race([canceled.promise, timeout.promise]);
          } catch {}

          canceled.cancel();
          timeout.cancel();
          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }
        } finally {
          state.cancelers.remove(inner.cancel);
        }
      }
    },
  });
};

const manageWebsocketChatLoopWithoutRetries = ({
  clientKey,
  out,
  journalChatJWT,
  journalEntryUID,
}: {
  clientKey: WrappedJournalClientKey;
  out: WritableValueWithCallbacks<JournalChatState>;
  journalChatJWT: string;
  journalEntryUID: string;
}): CancelablePromise<'failed-retryable' | 'success'> => {
  return constructCancelablePromise({
    body: async (state, resolve, reject) => {
      const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
      canceled.promise.catch(() => {});
      if (state.finishing) {
        canceled.cancel();
        reject(new Error('canceled'));
        return null;
      }
      {
        const initialState: JournalChatState = {
          uid: journalEntryUID,
          integrity: '',
          data: [],
          transient: null,
        };
        initialState.integrity = await computeJournalChatStateDataIntegrity(initialState);
        if (state.finishing) {
          canceled.cancel();
          reject(new Error('canceled'));
          return null;
        }
        setVWC(out, initialState, () => false);
      }

      const ws = new WebSocket(HTTP_WEBSOCKET_URL + '/api/2/journals/chat');
      const messageQueue = createWritableValueWithCallbacks<any[]>([]);
      const onMessage = (e: MessageEvent<any>) => {
        messageQueue.get().push(JSON.parse(e.data));
        messageQueue.callbacks.call(undefined);
      };
      ws.addEventListener('message', onMessage);
      try {
        const readyStateVWC = createWritableValueWithCallbacks(ws.readyState);
        const cleanupReadyState = (() => {
          ws.addEventListener('open', onOpen);
          ws.addEventListener('close', onClose);
          ws.addEventListener('error', onError);
          updateReadyState(ws.readyState);

          function onOpen() {
            updateReadyState(WebSocket.OPEN);
          }

          function onClose() {
            updateReadyState(WebSocket.CLOSED);
          }

          function onError() {
            updateReadyState(WebSocket.CLOSED);
          }

          function updateReadyState(newState: number) {
            setVWC(readyStateVWC, newState);
          }

          return () => {
            ws.removeEventListener('open', onOpen);
            ws.removeEventListener('close', onClose);
            ws.removeEventListener('error', onError);
          };
        })();
        try {
          {
            const readyStateCancelable = waitForValueWithCallbacksConditionCancelable(
              readyStateVWC,
              (s) => s !== WebSocket.CONNECTING
            );
            readyStateCancelable.promise.catch(() => {});
            const readyStateTimeout = createCancelableTimeout(30_000);
            readyStateTimeout.promise.catch(() => {});

            await Promise.race([
              readyStateCancelable.promise,
              readyStateTimeout.promise,
              canceled.promise,
            ]);

            if (state.finishing) {
              readyStateCancelable.cancel();
              readyStateTimeout.cancel();
              state.done = true;
              reject(new Error('canceled'));
              return;
            }

            if (readyStateTimeout.done()) {
              readyStateCancelable.cancel();
              state.done = true;
              resolve('failed-retryable');
              return;
            }

            readyStateCancelable.cancel();
            readyStateTimeout.cancel();

            if (readyStateVWC.get() !== WebSocket.OPEN) {
              console.warn('websocket did not open');
              state.done = true;
              resolve('failed-retryable');
              return;
            }
          }

          ws.send(
            JSON.stringify({
              type: 'authorize',
              data: {
                jwt: journalChatJWT,
              },
            })
          );

          const closedCancelable = waitForValueWithCallbacksConditionCancelable(
            readyStateVWC,
            (s) => s !== WebSocket.OPEN
          );
          closedCancelable.promise.catch(() => {});
          try {
            {
              const authResponseCancelable = waitForValueWithCallbacksConditionCancelable(
                messageQueue,
                (q) => q.length > 0
              );
              const authResponseTimeout = createCancelableTimeout(30_000);
              await Promise.race([
                authResponseCancelable.promise,
                authResponseTimeout.promise,
                canceled.promise,
                closedCancelable.promise,
              ]);

              if (state.finishing) {
                authResponseCancelable.cancel();
                authResponseTimeout.cancel();
                state.done = true;
                reject(new Error('canceled'));
                return;
              }

              if (authResponseTimeout.done()) {
                authResponseCancelable.cancel();
                state.done = true;
                resolve('failed-retryable');
                return;
              }

              if (closedCancelable.done()) {
                authResponseCancelable.cancel();
                authResponseTimeout.cancel();
                state.finishing = true;
                state.done = true;
                resolve('failed-retryable');
                return;
              }
              authResponseTimeout.cancel();

              const authResponse = messageQueue.get().shift();
              if (authResponse === undefined) {
                throw new Error('impossible');
              }
              messageQueue.callbacks.call(undefined);
              if (!authResponse.success) {
                state.finishing = true;
                console.warn('authorization rejected on chat websocket:', authResponse);
                state.done = true;
                reject(new Error('authorization rejected'));
                return;
              }
            }

            while (true) {
              const readTimeoutCancelable = createCancelableTimeout(30_000);
              const readCancelable = waitForValueWithCallbacksConditionCancelable(
                messageQueue,
                (q) => q.length > 0
              );
              await Promise.race([
                readTimeoutCancelable.promise,
                readCancelable.promise,
                canceled.promise,
                closedCancelable.promise,
              ]);
              if (state.finishing) {
                readCancelable.cancel();
                readTimeoutCancelable.cancel();
                state.done = true;
                reject(new Error('canceled'));
                return;
              }
              if (readTimeoutCancelable.done()) {
                readCancelable.cancel();
                state.done = true;
                resolve('failed-retryable');
                return;
              }
              if (closedCancelable.done()) {
                readCancelable.cancel();
                readTimeoutCancelable.cancel();
                state.finishing = true;
                state.done = true;
                resolve('failed-retryable');
                return;
              }
              readTimeoutCancelable.cancel();
              const message = messageQueue.get().shift();
              if (message === undefined) {
                throw new Error('impossible');
              }
              messageQueue.callbacks.call(undefined);

              if (!message.success) {
                console.log('unexpected top-level error in chat; treating as retryable: ', message);
                state.finishing = true;
                state.done = true;
                resolve('failed-retryable');
                return;
              }

              if (message.type !== 'event_batch') {
                console.warn('ignoring unexpected message type:', message);
                continue;
              }

              const events = message.data.events as any[];
              let seenEnd = false;
              let chatState = out.get();
              for (const event of events) {
                if (event.type === 'thinking-bar' || event.type === 'thinking-spinner') {
                  chatState.transient = event;
                } else if (event.type === 'error') {
                  console.warn('server experienced error producing system response', event);
                  state.finishing = true;
                  state.done = true;
                  reject(event);
                  return;
                } else if (event.type === 'chat') {
                  const decryptedSegmentData = await clientKey.key.decrypt(
                    event.encrypted_segment_data,
                    await getCurrentServerTimeMS()
                  );
                  const segmentData = JSON.parse(decryptedSegmentData);
                  console.log(decryptedSegmentData);

                  for (const mutation of segmentData.mutations) {
                    if (mutation.key.length === 0) {
                      chatState = mutation.value;
                    } else {
                      deepSet(chatState, mutation.key, mutation.value);
                    }
                  }

                  if (!event.more) {
                    seenEnd = true;
                  }
                  chatState.transient = null;
                } else {
                  console.warn('ignoring unknown event:', event);
                }
              }
              const expectedIntegrity = await computeJournalChatStateDataIntegrity(
                chatState,
                false
              );
              if (chatState.integrity !== expectedIntegrity) {
                console.warn(
                  'integrity mismatch after parsing events! expected',
                  expectedIntegrity,
                  'got',
                  chatState.integrity
                );
                await computeJournalChatStateDataIntegrity(chatState, true);
                state.finishing = true;
                state.done = true;
                reject(new Error('integrity mismatch'));
                return;
              }
              out.set(chatState);
              out.callbacks.call(undefined);

              if (seenEnd) {
                state.finishing = true;
                state.done = true;
                resolve('success');
                return;
              }
            }
          } finally {
            closedCancelable.cancel();
          }
        } finally {
          cleanupReadyState();
        }
      } finally {
        canceled.cancel();
        ws.removeEventListener('message', onMessage);
        ws.close();
      }
    },
  });
};

const deepSet = (obj: any, path: (string | number)[], value: any) => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (path.length === 0) {
    return value;
  }

  const [head, ...tail] = path;
  if (tail.length === 0) {
    obj[head] = value;
    return obj;
  }

  if (obj[head] === undefined) {
    obj[head] = typeof tail[0] === 'number' ? [] : {};
  }

  deepSet(obj[head], tail, value);
  return obj;
};
