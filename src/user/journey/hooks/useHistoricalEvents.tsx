import { MutableRefObject, useEffect, useRef } from 'react';
import { JourneyEvent } from '../models/JourneyEvent';
import { JourneyTime } from './useJourneyTime';
import { heappush as unboundHeapPush, heappop as unboundHeapPop } from '../../../shared/lib/Heap';
import { HTTP_API_URL } from '../../../shared/ApiConstants';

const heappush = unboundHeapPush.bind(undefined, 'journey_time');
const heappop = unboundHeapPop.bind(undefined, 'journey_time');

/**
 * Provides events to a mutable callback list as they occur in the journey.
 * This is specifically for historical events, i.e., events that are retrieved
 * from the journey events search API, which has a slight delay, plus we prefetch
 * them.
 *
 * To get events that occur in real time, this is combined with useLiveEvents.
 */
export type HistoricalEvents = {
  /**
   * The list of callbacks that should be called whenever an event "occurs", i.e.,
   * when the journey time goes from before the event time to after the event time
   * from our perspective. For a convenient way to register these events, you can
   * use useHistoricalEventCallback
   */
  onEvent: MutableRefObject<((event: JourneyEvent) => void)[]>;
};

type HistoricalEventKwargs = {
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
 * Provides a feed of historical events for a journey, via a mutable callback
 * list. Note that this will not provide all the events, even if no other events
 * are occuring in real time, due to automatic throttling based on network
 * conditions.
 */
export const useHistoricalEvents = ({
  journeyUid,
  journeyJwt,
  journeyDurationSeconds,
  journeyTime,
}: HistoricalEventKwargs): HistoricalEvents => {
  const onEvent = useRef<((event: JourneyEvent) => void)[]>([]);

  useEffect(() => {
    let active = true;
    let doneWithEvents = false;
    const bonusCancelCallbacks: (() => void)[] = [];
    const newEventListeners: (() => void)[] = [];

    const eventHeap: JourneyEvent[] = [];
    let lookahead = 3;
    let bandwidth = 100;
    let goodStreak = 0;

    fetchEvents();
    pushEvents();
    return () => {
      active = false;
      const cpCallbacks = bonusCancelCallbacks.slice();
      for (const callback of cpCallbacks) {
        callback();
      }
    };

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
        bonusCancelCallbacks.push(onCancelled);

        const onTimeChange = (lastTime: DOMHighResTimeStamp, newTime: DOMHighResTimeStamp) => {
          if (!active) {
            return;
          }
          if (newTime >= targetTime) {
            bonusCancelCallbacks.splice(bonusCancelCallbacks.indexOf(onCancelled), 1);

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

    function sleepUntilNewEvents(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        if (!active || doneWithEvents) {
          reject('unmounted');
          return;
        }

        const predictedIndex = newEventListeners.length;
        const tryRemoveNewEventListener = () => {
          for (let i = Math.min(predictedIndex, newEventListeners.length - 1); i >= 0; i--) {
            if (newEventListeners[i] === onNewEvents) {
              newEventListeners.splice(i, 1);
              return true;
            }
          }

          return false;
        };

        const onCancelled = () => {
          if (!tryRemoveNewEventListener()) {
            reject(new Error('onNewEvents callback not found in newEventListeners list!'));
            return;
          }
          reject('unmounted');
        };
        bonusCancelCallbacks.push(onCancelled);

        const onNewEvents = () => {
          if (!active) {
            return;
          }
          bonusCancelCallbacks.splice(bonusCancelCallbacks.indexOf(onCancelled), 1);

          if (!tryRemoveNewEventListener()) {
            reject(new Error('onNewEvents callback not found in newEventListeners list!'));
            return;
          }

          resolve();
        };

        newEventListeners.push(onNewEvents);
      });
    }

    async function fetchEvents() {
      let nextBin = Math.max(Math.floor(journeyTime.time.current / 1000), 0);
      let failures = 0;
      const finalBin = Math.floor(journeyDurationSeconds);

      const handleFailure = async () => {
        failures += 1;
        if (failures < 5) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      };

      while (nextBin <= finalBin) {
        if (!active) {
          return;
        }

        const dontPrefetchBefore = (nextBin - lookahead) * 1000;
        const timeUntilDontPrefetchBefore = dontPrefetchBefore - journeyTime.time.current;
        if (timeUntilDontPrefetchBefore > 0) {
          if (timeUntilDontPrefetchBefore > 500 && bandwidth <= 240) {
            goodStreak += 1;
            if (goodStreak < 5) {
              bandwidth += 10;
            } else {
              bandwidth += 25;
            }
          }

          try {
            await sleepUntilJourneyTime(dontPrefetchBefore);
          } catch (e) {
            if (!active) {
              return;
            }

            throw e;
          }
        } else if (nextBin < journeyTime.time.current && bandwidth > 20) {
          goodStreak = 0;
          bandwidth = Math.floor(bandwidth / 2);
          console.log(
            'poor network conditions, decreasing historical bandwidth to',
            bandwidth,
            'events per second'
          );
        }

        let response: Response;
        try {
          response = await fetch(HTTP_API_URL + '/api/1/journeys/events/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              Authorization: `bearer ${journeyJwt}`,
            },
            body: JSON.stringify({
              filters: {
                journey_uid: {
                  operator: 'eq',
                  value: journeyUid,
                },
                journey_time: {
                  operator: 'bte',
                  value: [nextBin, nextBin + 1],
                },
                dropout_for_total: {
                  operator: 'eq',
                  value: bandwidth,
                },
              },
              sort: [
                {
                  key: 'random',
                  dir: 'asc',
                },
              ],
              limit: bandwidth + Math.floor(3 * Math.sqrt(bandwidth)),
            }),
          });
        } catch (e) {
          console.error(e);

          await handleFailure();
          continue;
        }

        if (!response.ok) {
          console.error(
            'unexpected status code from /api/1/journeys/events/search:',
            response.status
          );
          await handleFailure();
          continue;
        }

        const data = await response.json();
        if (!active) {
          return;
        }

        const items: JourneyEvent[] = data.items;
        for (const ev of items) {
          heappush(eventHeap, ev);
        }

        // this has to be done before callbacks
        if (nextBin + 1 === finalBin) {
          doneWithEvents = true;
        }

        const cpListeners = newEventListeners.slice();
        for (const listener of cpListeners) {
          listener();
        }

        nextBin += 1;
      }
    }

    async function pushEvents() {
      while (active) {
        if (eventHeap.length > 0 && eventHeap[0].journey_time * 1000 <= journeyTime.time.current) {
          let delay = journeyTime.time.current - eventHeap[0].journey_time * 1000;
          if (delay > 500) {
            goodStreak = 0;
            if (bandwidth > 20) {
              bandwidth = Math.floor(bandwidth / 2);
              console.log(
                'poor cpu conditions detected, bandwidth reduced to',
                bandwidth,
                'events per second and dropping events to catch up'
              );
            }

            while (
              eventHeap.length > 0 &&
              eventHeap[0].journey_time * 1000 <= journeyTime.time.current
            ) {
              heappop(eventHeap);
            }
            continue;
          }

          const ev = heappop(eventHeap);
          const cpListeners = onEvent.current.slice();
          for (const cb of cpListeners) {
            cb(ev);
          }
          continue;
        }

        if (eventHeap.length > 0 && doneWithEvents) {
          const timeOfNextEvent = eventHeap[0].journey_time * 1000;
          try {
            await sleepUntilJourneyTime(timeOfNextEvent);
          } catch (e) {
            if (!active) {
              return;
            }
            throw e;
          }
          continue;
        }

        if (eventHeap.length > 0) {
          const timeOfNextEvent = eventHeap[0].journey_time * 1000;
          try {
            await Promise.race([sleepUntilJourneyTime(timeOfNextEvent), sleepUntilNewEvents()]);
          } catch (e) {
            if (!active) {
              return;
            }
            throw e;
          }
          continue;
        }

        if (doneWithEvents) {
          return;
        }

        try {
          await sleepUntilNewEvents();
        } catch (e) {
          if (!active) {
            return;
          }
          throw e;
        }
      }
    }
  }, [journeyUid, journeyJwt, journeyDurationSeconds, journeyTime.onTimeChanged, journeyTime.time]);

  return {
    onEvent,
  };
};

/**
 * Ensures that the given callback is called whenever the given historical events
 * occur. This is a convenience wrapper around the onEvent callback list.
 *
 * @param historicalEvents The historical events to listen to
 * @param callback The callback to call whenever an event occurs
 */
export const useHistoricalEventCallback = (
  historicalEvents: HistoricalEvents,
  callback: (event: JourneyEvent) => void
) => {
  useEffect(() => {
    const predictedIndex = historicalEvents.onEvent.current.length;
    historicalEvents.onEvent.current.push(callback);
    return () => {
      for (let i = predictedIndex; i >= 0; i--) {
        if (historicalEvents.onEvent.current[i] === callback) {
          historicalEvents.onEvent.current.splice(i, 1);
          return;
        }
      }

      console.error('failed to remove historical event callback', callback);
    };
  }, [callback, historicalEvents.onEvent]);
};
