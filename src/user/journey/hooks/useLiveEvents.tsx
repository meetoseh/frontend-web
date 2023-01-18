import { MutableRefObject, useEffect, useRef } from 'react';
import { JourneyEvent } from '../models/JourneyEvent';
import { JourneyTime } from './useJourneyTime';
import { heappush as unboundHeapPush, heappop as unboundHeapPop } from '../../../shared/lib/Heap';
import { HTTP_WEBSOCKET_URL } from '../../../shared/ApiConstants';
import { useHistoricalEventCallback } from './useHistoricalEvents';

const heappush = unboundHeapPush.bind(undefined, 'journey_time');
const heappop = unboundHeapPop.bind(undefined, 'journey_time');

/**
 * Provides events to a mutable callback list as they occur in the journey.
 * This is specifically for live events, i.e., events that are retrieved
 * from the live event websocket feed.
 */
export type LiveEvents = {
  /**
   * The list of callbacks that should be called whenever an event "occurs", i.e.,
   * when the journey time goes from before the event time to after the event time
   * from our perspective. For a convenient way to register these events, you can
   * use useLiveEventCallback
   */
  onEvent: MutableRefObject<((event: JourneyEvent) => void)[]>;
};

type LiveEventKwargs = {
  /**
   * The UID of the journey to get events for
   */
  journeyUid: string;

  /**
   * The JWT for the journey to get events for
   */
  journeyJwt: string;

  /**
   * How long the journey is in seconds
   */
  journeyDurationSeconds: number;

  /**
   * The journey time from our perspective, which is used to determine when
   * events occur
   */
  journeyTime: JourneyTime;
};

/**
 * Provides a feed of live events for a journey, via a mutable callback list.
 * Note that this will not provide all the events - it will not provide
 * historical events and potentially some live events due to automatic
 * throttling based on network conditions.
 */
export const useLiveEvents = ({
  journeyUid,
  journeyJwt,
  journeyDurationSeconds,
  journeyTime,
}: LiveEventKwargs): LiveEvents => {
  const onEvent = useRef<((event: JourneyEvent) => void)[]>([]);

  useEffect(() => {
    let active = true;
    const bonusCancelCallbacks: Set<() => void> = new Set();
    const newEventCallbacks: Set<() => void> = new Set();
    const eventHeap: JourneyEvent[] = [];
    fetchEvents();
    pushEvents();
    const unmount = () => {
      if (!active) {
        return;
      }

      active = false;
      const cancelCallbacks = [];
      const iter = bonusCancelCallbacks.values();
      let next = iter.next();
      while (!next.done) {
        cancelCallbacks.push(next.value);
        next = iter.next();
      }

      for (const cancelCallback of cancelCallbacks) {
        cancelCallback();
      }
    };
    return unmount;

    function sleepUntilJourneyTime(targetTime: DOMHighResTimeStamp): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        if (!active) {
          reject('unmounted');
          return;
        }

        const predictedIndex = journeyTime.onTimeChanged.current.length;
        const tryRemoveOnTimeChanged = () => {
          for (
            let i = Math.min(predictedIndex, journeyTime.onTimeChanged.current.length - 1);
            i >= 0;
            i--
          ) {
            if (journeyTime.onTimeChanged.current[i] === onTimeChange) {
              journeyTime.onTimeChanged.current.splice(i, 1);
              return true;
            }
          }

          return false;
        };

        const onCancelled = () => {
          if (!tryRemoveOnTimeChanged()) {
            reject(new Error('onTimeChange callback not found in onTimeChanged list!'));
            return;
          }
          reject('unmounted');
        };
        bonusCancelCallbacks.add(onCancelled);

        const onTimeChange = (lastTime: DOMHighResTimeStamp, newTime: DOMHighResTimeStamp) => {
          if (!active) {
            return;
          }
          if (newTime >= targetTime) {
            bonusCancelCallbacks.delete(onCancelled);

            if (!tryRemoveOnTimeChanged()) {
              reject(new Error('onTimeChange callback not found in onTimeChanged list!'));
              return;
            }

            resolve();
          }
        };

        journeyTime.onTimeChanged.current.push(onTimeChange);
      });
    }

    function informNewEventListeners() {
      const cpNewEvents = [];
      const iter = newEventCallbacks.values();
      let next = iter.next();
      while (!next.done) {
        cpNewEvents.push(next.value);
        next = iter.next();
      }
      for (const callback of cpNewEvents) {
        callback();
      }
    }

    function sleepUntilNewEvents(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        if (!active) {
          reject('unmounted');
          return;
        }

        const removeListeners = () => {
          bonusCancelCallbacks.delete(onCancel);
          newEventCallbacks.delete(onNewEvent);
        };

        const onCancel = () => {
          removeListeners();
          reject('unmounted');
        };

        const onNewEvent = () => {
          removeListeners();
          resolve();
        };

        bonusCancelCallbacks.add(onCancel);
        newEventCallbacks.add(onNewEvent);
      });
    }

    function sleepUntilUnmounted(doAbort: (aborter: () => void) => void): Promise<void> {
      return new Promise((resolve, reject) => {
        let finished = false;

        const onAbort = () => {
          if (finished) {
            return;
          }

          finished = true;
          bonusCancelCallbacks.delete(onCancel);
          reject('aborted');
        };

        const onCancel = () => {
          if (finished) {
            return;
          }

          finished = true;
          bonusCancelCallbacks.delete(onCancel);
          resolve();
        };

        bonusCancelCallbacks.add(onCancel);
        doAbort(onAbort);
      });
    }

    async function fetchEvents() {
      let pws: PromiseWebSocket | null = null;
      let state:
        | 'unconnected'
        | 'awaiting_open'
        | 'awaiting_sync_request'
        | 'awaiting_auth_response'
        | 'awaiting_events' = 'unconnected';
      let failures = 0;

      let bandwidth = 100;
      let lookahead = 3;
      let lookback = 3;

      let maxSyncMismatch = 50; // ms
      let resetsDueToSyncMismatch = 0;

      const handleFailure = async () => {
        failures++;
        if (failures < 5) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      };

      try {
        while (active && journeyTime.time.current <= journeyDurationSeconds * 1000) {
          if (state === 'unconnected') {
            if (pws !== null) {
              throw new Error('pws should be null in unconnected state');
            }

            pws = newPromiseWebSocket(`${HTTP_WEBSOCKET_URL}/api/2/journeys/live`);
            (async (pws: PromiseWebSocket) => {
              try {
                const err = await pws.getError(null);
                console.error('error opening live events socket:', err);
              } catch (e) {
                if (e !== 'unmounted' && e !== 'closed') {
                  console.error('error retrieving error:', e);
                }
              }
            })(pws);
            state = 'awaiting_open';
            continue;
          }

          if (pws === null) {
            throw new Error('pws should not be null unless in unconnected state');
          }

          if (state === 'awaiting_open') {
            const aborters: (() => void)[] = [];
            await Promise.race([
              pws.getOpen((aborter) => aborters.push(aborter)),
              pws.getClose((aborter) => aborters.push(aborter)),
              sleepUntilUnmounted((aborter) => aborters.push(aborter)),
            ]).catch((e) => {});

            for (const aborter of aborters) {
              aborter();
            }

            if (!active) {
              return;
            }

            if (pws.ws.readyState !== WebSocket.OPEN) {
              await handleFailure();
              state = 'unconnected';
              pws = null;
              continue;
            }

            pws.ws.send(
              JSON.stringify({
                type: 'authorize',
                data: {
                  journey_uid: journeyUid,
                  jwt: journeyJwt,
                  bandwidth,
                  lookback,
                  lookahead,
                },
              })
            );

            state = 'awaiting_sync_request';
            continue;
          }

          {
            const aborters: (() => void)[] = [];
            await Promise.race([
              pws.getMessage((aborter) => aborters.push(aborter), false),
              pws.getClose((aborter) => aborters.push(aborter)),
              sleepUntilUnmounted((aborter) => aborters.push(aborter)),
            ]).catch((e) => {});
            for (const aborter of aborters) {
              aborter();
            }
            if (!active) {
              return;
            }

            if (pws.ws.readyState !== WebSocket.OPEN) {
              await handleFailure();
              state = 'unconnected';
              pws = null;
              continue;
            }
          }

          const msg = await pws.getMessage(null, true);

          if (state === 'awaiting_sync_request') {
            if (!msg.success) {
              console.error('failed to authorize:', msg);
              unmount();
              return;
            }

            if (msg.type !== 'sync_request') {
              console.error('unexpected message after authorize:', msg);
              unmount();
              return;
            }

            pws.ws.send(
              JSON.stringify({
                type: 'sync_response',
                data: {
                  receive_timestamp: journeyTime.time.current / 1000,
                  transmit_timestamp: journeyTime.time.current / 1000,
                },
              })
            );
            state = 'awaiting_auth_response';
            continue;
          }

          if (state === 'awaiting_auth_response') {
            if (!msg.success) {
              console.error('failed to send sync response:', msg);
              unmount();
              return;
            }

            if (msg.type !== 'auth_response') {
              console.error('unexpected message after sync response:', msg);
              unmount();
              return;
            }

            state = 'awaiting_events';
            continue;
          }

          if (state !== 'awaiting_events') {
            throw new Error(`invalid state: ${state}`);
          }

          if (!msg.success) {
            console.error('server sent unsuccessful response during event batch phase:', msg);
            unmount();
            return;
          }

          if (msg.type === 'event_batch') {
            const events: JourneyEvent[] = msg.data.events;
            for (const ev of events) {
              heappush(eventHeap, ev);
            }
            informNewEventListeners();
            continue;
          }

          if (msg.type === 'latency_detection') {
            const expectedReceiveJourneyTime: number =
              msg.data.expected_receive_journey_time * 1000;
            const currentJourneyTime = journeyTime.time.current;

            const syncDifference = Math.abs(expectedReceiveJourneyTime - currentJourneyTime);
            if (syncDifference > maxSyncMismatch) {
              console.log(
                'live events sync mismatch exceeds threshold;',
                syncDifference,
                '>',
                maxSyncMismatch
              );
              if (resetsDueToSyncMismatch === 0) {
                console.log('resetting with same settings');
              } else if (resetsDueToSyncMismatch <= 2) {
                console.log('doubling max sync mismatch and resetting');
                maxSyncMismatch *= 2;
              } else if (resetsDueToSyncMismatch <= 4) {
                console.log(
                  'halving bandwidth, decreasing lookback and lookahead by 0.5, and resetting'
                );
                bandwidth /= 2;
                lookahead -= 0.5;
                lookback -= 0.5;
              } else {
                console.log('doubling max sync mismatch and resetting');
                maxSyncMismatch *= 2;
              }
              resetsDueToSyncMismatch++;
              pws.ws.close();
              state = 'unconnected';
              pws = null;
              continue;
            }
            continue;
          }

          console.log('ignoring unknown message on live events socket:', msg);
        }
      } catch (e) {
        if (!active) {
          return;
        }
        console.error(e);
        unmount();
      } finally {
        if (
          pws !== null &&
          pws.ws.readyState !== WebSocket.CLOSING &&
          pws.ws.readyState !== WebSocket.CLOSED
        ) {
          pws.ws.close();
        }
      }
    }

    async function pushEvents() {
      try {
        while (active) {
          while (
            eventHeap.length > 0 &&
            eventHeap[0].journey_time * 1000 <= journeyTime.time.current &&
            active
          ) {
            const ev = heappop(eventHeap);
            const cpCallbacks = onEvent.current.slice();
            for (const callback of cpCallbacks) {
              callback(ev);
            }
          }

          if (eventHeap.length === 0) {
            if (journeyTime.time.current >= journeyDurationSeconds * 1000 + 250) {
              unmount();
              return;
            }
            await Promise.race([
              sleepUntilNewEvents(),
              sleepUntilJourneyTime(journeyDurationSeconds * 1000 + 250),
            ]);
            continue;
          }

          await Promise.race([
            sleepUntilNewEvents(),
            sleepUntilJourneyTime(eventHeap[0].journey_time * 1000),
          ]);
        }
      } catch (e) {
        if (!active) {
          return;
        }
        console.error(e);
        unmount();
      }
    }
  }, [journeyUid, journeyJwt, journeyDurationSeconds, journeyTime.onTimeChanged, journeyTime.time]);

  return { onEvent };
};

/**
 * Ensures that the given callback is called whenever the given live events
 * occur. This is a convenience wrapper around the onEvent callback list.
 *
 * @param liveEvents The live events to listen to
 * @param callback The callback to call whenever an event occurs
 */
export const useLiveEventCallback = (
  liveEvents: LiveEvents,
  callback: (event: JourneyEvent) => void
) => useHistoricalEventCallback(liveEvents, callback);

/**
 * Makes a websocket easier to use in an async context.
 */
type PromiseWebSocket = {
  /**
   * The underlying websocket, for e.g. closing it.
   */
  ws: WebSocket;

  /**
   * Returns a promise which resolves when the websocket opens and rejects
   * when it closes or errors. Can be called from any state.
   *
   * @param doAbort stand-in for AbortSignal since it's still <95% supported
   *   due to people being slow to update their browsers. If provided, this
   *   is called with a function which can be called to abort the request.
   *   Failure to abort the request will result in a memory leak.
   */
  getOpen: (doAbort: ((abort: () => void) => void) | undefined | null) => Promise<void>;
  /**
   * Returns a promise which resolves when the websocket closes. Can be
   * called from any state.
   *
   * @param doAbort stand-in for AbortSignal since it's still <95% supported
   *   due to people being slow to update their browsers. If provided, this
   *   is called with a function which can be called to abort the request.
   *   Failure to abort the request will result in a memory leak.
   */
  getClose: (doAbort: ((abort: () => void) => void) | undefined | null) => Promise<void>;
  /**
   * Returns a promise which resolves when the websocket errors. Can be
   * called from any state, but will resolve at most once. Rejects if
   * the websocket closes before erroring.
   *
   * @param doAbort stand-in for AbortSignal since it's still <95% supported
   *   due to people being slow to update their browsers. If provided, this
   *   is called with a function which can be called to abort the request.
   *   Failure to abort the request will result in a memory leak.
   */
  getError: (doAbort: ((abort: () => void) => void) | undefined | null) => Promise<Event>;
  /**
   * Returns a promise which resolves when a message is received, after JSON
   * parsing. If this is called in parallel, an arbitrary one will get the
   * message, but only one.
   *
   * @param doAbort stand-in for AbortSignal since it's still <95% supported
   *   due to people being slow to update their browsers. If provided, this
   *   is called with a function which can be called to abort the request.
   *   Failure to abort the request will result in a memory leak.
   * @param consume if true, the message will be consumed and returned, otherwise,
   *   the promise will resolve with null, and the next getMessage will resolve
   *   immediately with the message
   */
  getMessage: (
    doAbort: ((abort: () => void) => void) | undefined | null,
    consume: boolean
  ) => Promise<any>;
};

/**
 * Creates a promise web socket, which is a more async friendly interface to
 * websockets. The websocket is already attempting to connect when this returns
 * @param uri The URI to connect to
 * @returns A promise websocket
 */
function newPromiseWebSocket(uri: string): PromiseWebSocket {
  const ws = new WebSocket(uri);
  const unreadMessages: any[] = [];

  const evListeners: Map<'close' | 'error' | 'open', Set<(ev: Event) => void>> = new Map();
  evListeners.set('close', new Set());
  evListeners.set('error', new Set());
  evListeners.set('open', new Set());

  const informListeners = (typ: 'close' | 'error' | 'open', ev: Event) => {
    const cpListeners = [];
    const iter = evListeners.get(typ)!.values();
    let next = iter.next();
    while (!next.done) {
      cpListeners.push(next.value);
      next = iter.next();
    }
    for (const listener of cpListeners) {
      listener(ev);
    }
  };

  const onNewMessageListeners: Set<() => void> = new Set();
  const informNewMessageListeners = () => {
    const cpListeners = [];
    const iter = onNewMessageListeners.values();
    let next = iter.next();
    while (!next.done) {
      cpListeners.push(next.value);
      next = iter.next();
    }
    for (const listener of cpListeners) {
      listener();
    }
  };

  ws.onclose = informListeners.bind(undefined, 'close');
  ws.onerror = informListeners.bind(undefined, 'error');
  ws.onopen = informListeners.bind(undefined, 'open');
  ws.onmessage = (ev: MessageEvent) => {
    const data = ev.data;
    if (data instanceof Blob) {
      const reader = new FileReader();
      reader.addEventListener('loadend', () => {
        if (reader.result === null) {
          console.error(new Error('Failed to read blob'));
          return;
        }

        unreadMessages.push(JSON.parse(reader.result as string)); // noqa
        informNewMessageListeners();
      });
      reader.readAsText(data, 'utf-8');
    } else {
      unreadMessages.push(JSON.parse(data)); // noqa
      informNewMessageListeners();
    }
  };

  const getOpen = (doAbort: ((abort: () => void) => void) | undefined | null) =>
    new Promise<void>((resolve, reject) => {
      if (ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        reject(new Error('WebSocket already closed'));
        return;
      }

      if (ws.readyState !== WebSocket.CONNECTING) {
        reject(new Error('WebSocket in unexpected state'));
        return;
      }

      let finished = false;
      const onAbort = () => {
        if (finished) {
          return;
        }

        finished = true;
        evListeners.get('open')!.delete(listener);
        reject('aborted');
      };

      const listener = () => {
        if (finished) {
          return;
        }

        finished = true;
        evListeners.get('open')!.delete(listener);
        resolve();
      };
      evListeners.get('open')!.add(listener);
      if (doAbort !== null && doAbort !== undefined) {
        doAbort(onAbort);
      }
    });

  const getClose = (doAbort: ((abort: () => void) => void) | undefined | null) =>
    new Promise<void>((resolve, reject) => {
      if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        resolve();
        return;
      }

      if (ws.readyState === WebSocket.OPEN) {
        reject(new Error('WebSocket already open'));
        return;
      }

      if (ws.readyState !== WebSocket.CONNECTING) {
        reject(new Error('WebSocket in unexpected state'));
        return;
      }

      let finished = false;
      const onAbort = () => {
        if (finished) {
          return;
        }

        finished = true;
        evListeners.get('close')!.delete(listener);
        reject('aborted');
      };

      const listener = () => {
        if (finished) {
          return;
        }

        finished = true;
        evListeners.get('close')!.delete(listener);
        resolve();
      };
      evListeners.get('close')!.add(listener);
      if (doAbort !== null && doAbort !== undefined) {
        doAbort(onAbort);
      }
    });

  const getError = (doAbort: ((abort: () => void) => void) | undefined | null) =>
    new Promise<Event>((resolve, reject) => {
      if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        reject(new Error('WebSocket already closed'));
        return;
      }

      const removeListeners = () => {
        evListeners.get('error')!.delete(errorListener);
        evListeners.get('close')!.delete(closeListener);
      };

      let finished = false;
      const onAbort = () => {
        if (finished) {
          return;
        }

        finished = true;
        removeListeners();
        reject('aborted');
      };

      const errorListener = (ev: Event) => {
        if (finished) {
          return;
        }

        finished = true;
        removeListeners();
        resolve(ev);
      };

      const closeListener = () => {
        if (finished) {
          return;
        }

        finished = true;
        removeListeners();
        reject('closed');
      };

      evListeners.get('error')!.add(errorListener);
      evListeners.get('close')!.add(closeListener);
      if (doAbort !== null && doAbort !== undefined) {
        doAbort(onAbort);
      }
    });

  const getMessage = (
    doAbort: ((abort: () => void) => void) | undefined | null,
    consume: boolean
  ) =>
    new Promise<any>((resolve, reject) => {
      if (unreadMessages.length > 0) {
        resolve(consume ? unreadMessages.shift() : null);
        return;
      }

      if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        reject(new Error('WebSocket already closed'));
      }

      const removeListeners = () => {
        onNewMessageListeners.delete(messageListener);
        evListeners.get('close')!.delete(closeListener);
      };

      let finished = false;
      const onAbort = () => {
        if (finished) {
          return;
        }

        finished = true;
        removeListeners();
        reject('aborted');
      };

      const messageListener = () => {
        if (finished) {
          return;
        }

        if (unreadMessages.length === 0) {
          return; // another listener was first
        }

        const msg = consume ? unreadMessages.shift() : null;
        finished = true;
        removeListeners();
        resolve(msg);
      };

      const closeListener = () => {
        if (finished) {
          return;
        }

        finished = true;
        removeListeners();
        reject(new Error('WebSocket closed before a message was received'));
      };

      onNewMessageListeners.add(messageListener);
      evListeners.get('close')!.add(closeListener);
      if (doAbort !== null && doAbort !== undefined) {
        doAbort(onAbort);
      }
    });

  return {
    ws,
    getOpen,
    getClose,
    getError,
    getMessage,
  };
}
