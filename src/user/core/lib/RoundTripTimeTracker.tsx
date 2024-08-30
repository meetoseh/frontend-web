import { createWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { constructCancelablePromise } from '../../../shared/lib/CancelablePromiseConstructor';
import { setVWC } from '../../../shared/lib/setVWC';
import { waitForValueWithCallbacksConditionCancelable } from '../../../shared/lib/waitForValueWithCallbacksCondition';
import { SimpleAsyncStorage } from './SimpleAsyncStorage';

/**
 * Describes an object that is helpful for estimating round trip times
 * using measurements on the client side.
 */
export type RoundTripTimeTracker = {
  /**
   * Returns the current estimated round trip time. This value may
   * change over time (for example, we may only consider data which
   * was measured recently as useful), thus this should only be called
   * as close to the time of use as possible.
   */
  estimateRoundTripTime: () => CancelablePromise<number>;

  /**
   * Begins measuring the time it takes to complete a round trip, returning
   * a function that should be called when the round trip is complete.
   */
  beginMeasurement: () => {
    /**
     * Indicates the measurement completed normally, storing the round trip
     * time for future estimates and returning the round trip time.
     *
     * NOTE: If finish() is called multiple times, this may return the
     * round trip time from the first call. It will never result in
     * multiple round trip times being stored. It is not advisable to
     * rely on this behavior.
     *
     * Does nothing if finish() or cancel() has already been called. If
     * cancel() and finish() are both called within one event loop tick,
     * then cancel() may take precedence even if they are called in the
     * opposite order.
     */
    finish: () => Promise<number | undefined>;

    /**
     * Indicates the measurement was cancelled, discarding the round trip time.
     * Generally, this should be called for non-success responses as well as
     * aborted requests.
     *
     * Does nothing if finish() or cancel() has already been called. If
     * cancel() and finish() are both called within one event loop tick,
     * then cancel() may take precedence even if they are called in the
     * opposite order.
     */
    cancel: () => void;
  };
};

type SlidingWindow = { timeMs: number; durationMs: number }[];

export type SlidingWindowEstimator = (stored: SlidingWindow, nowMs: number) => number;

/**
 * Creates a round trip tracker that remembers the last N round trip times and
 * uses them to estimate the current round trip time.
 */
export const createSlidingWindowRoundTripTimeTracker = ({
  maxEntries,
  maxAgeMs,
  estimator,
  storage,
}: {
  /** the maximum number of entries in the window */
  maxEntries?: number;
  /** the maximum age of entries in the window before they are discarded */
  maxAgeMs?: number;
  /** estimates the time based on the current window */
  estimator: SlidingWindowEstimator;
  /** the function for storing state; provided null to remove */
  storage: SimpleAsyncStorage;
}): RoundTripTimeTracker => {
  if (maxEntries === undefined && maxAgeMs === undefined) {
    throw new Error('Must provide at least one of maxEntries and maxAgeMs');
  }

  const parseStored = (stored: string | null): SlidingWindow => {
    let parsedWindowRaw = stored === null ? [] : JSON.parse(stored);
    if (!Array.isArray(parsedWindowRaw)) {
      console.warn(
        `SlidingWindowRoundTripTimeTracker: invalid stored value: ${stored} - treating like empty`
      );
      parsedWindowRaw = [];
    }
    for (let i = parsedWindowRaw.length - 1; i >= 0; i--) {
      const v = parsedWindowRaw[i];
      if (
        typeof v !== 'object' ||
        v === null ||
        typeof v.timeMs !== 'number' ||
        typeof v.durationMs !== 'number'
      ) {
        console.warn(
          `SlidingWindowRoundTripTimeTracker: invalid stored value: ${v} at index ${i} - removing`
        );
        parsedWindowRaw.splice(i, 1);
      }
    }
    return parsedWindowRaw;
  };

  const cleanWindow = (parsedWindow: SlidingWindow, nowMs: number): SlidingWindow => {
    let cleanedWindow =
      maxEntries === undefined || parsedWindow.length <= maxEntries
        ? parsedWindow
        : parsedWindow.slice(-maxEntries);
    if (maxAgeMs !== undefined) {
      cleanedWindow = cleanedWindow.filter((e) => nowMs - e.timeMs <= maxAgeMs);
    }
    return cleanedWindow;
  };

  return {
    estimateRoundTripTime: () =>
      constructCancelablePromise({
        body: async (state, resolve, reject) => {
          const controller = new AbortController();
          const doAbort = () => controller.abort();
          state.cancelers.add(doAbort);
          if (state.finishing) {
            state.cancelers.remove(doAbort);
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          try {
            let estimated: number | undefined = undefined;
            await storage.withStore(
              async (stored) => {
                const current = parseStored(stored);
                const nowMs = Date.now();
                const cleaned = cleanWindow(current, nowMs);
                estimated = estimator(cleaned, nowMs);
                return JSON.stringify(cleaned);
              },
              { signal: controller.signal }
            );
            if (estimated === undefined) {
              if (state.finishing) {
                state.done = true;
                reject(new Error('canceled'));
                return;
              }

              state.finishing = true;
              state.done = true;
              reject(new Error('estimated undefined despite not aborted'));
              return;
            }

            state.finishing = true;
            state.done = true;
            resolve(estimated);
          } catch (e) {
            state.finishing = true;
            state.done = true;
            reject(e);
            return;
          }
        },
      }),

    beginMeasurement: () => {
      const finishedVWC = createWritableValueWithCallbacks(false);
      const canceledVWC = createWritableValueWithCallbacks(false);
      const storedRTTVWC = createWritableValueWithCallbacks<number | undefined | null>(null);
      const startedAt = Date.now();
      const startedAtPerf = performance.now();
      handleCompletion();
      return {
        finish: async () => {
          setVWC(finishedVWC, true);
          const storedRTTCancelable = waitForValueWithCallbacksConditionCancelable(
            storedRTTVWC,
            (v) => v !== null
          );
          const result = await storedRTTCancelable.promise;
          if (result === null) {
            throw new Error('impossible');
          }
          return result;
        },
        cancel: () => setVWC(canceledVWC, true),
      };

      async function handleCompletion() {
        const finishedCancelable = waitForValueWithCallbacksConditionCancelable(
          finishedVWC,
          (v) => v
        );
        const canceledCancelable = waitForValueWithCallbacksConditionCancelable(
          canceledVWC,
          (v) => v
        );

        finishedCancelable.promise.catch(() => {});
        canceledCancelable.promise.catch(() => {});

        await Promise.race([finishedCancelable.promise, canceledCancelable.promise]);
        finishedCancelable.cancel();
        canceledCancelable.cancel();

        if (canceledVWC.get()) {
          setVWC(storedRTTVWC, undefined);
          return;
        }

        const finishedAtPerf = performance.now();
        const duration = finishedAtPerf - startedAtPerf;

        try {
          await storage.withStore(
            async (stored) => {
              const parsedWindow = parseStored(stored);
              parsedWindow.push({ timeMs: startedAt, durationMs: duration });
              const cleaned = cleanWindow(parsedWindow, startedAt);
              return JSON.stringify(cleaned);
            },
            {
              signal: new AbortController().signal,
            }
          );
          setVWC(storedRTTVWC, duration);
        } catch (e) {
          setVWC(storedRTTVWC, undefined);
        }
      }
    },
  };
};

/**
 * Creates our current preferred round trip time tracker. The technique used is
 * not guarranteed.
 *
 * Currently, this uses a sliding window of the last 5 requests within the last week,
 * and estimates the round trip time as the longest duration of those requests.
 */
export const createStandardRoundTripTimeTracker = ({ storage }: { storage: SimpleAsyncStorage }) =>
  createSlidingWindowRoundTripTimeTracker({
    maxEntries: 5,
    maxAgeMs: 1000 * 60 * 60 * 24 * 7,
    estimator: (stored) => {
      if (stored.length === 0) {
        return 350;
      }
      let highest = 0;
      for (const e of stored) {
        if (e.durationMs > highest) {
          highest = e.durationMs;
        }
      }
      return highest;
    },
    storage,
  });
