import { useEffect, useState } from 'react';
import { HTTP_API_URL } from '../../../shared/ApiConstants';
import { Prompt } from '../models/JourneyRef';
import { JourneyTime } from './useJourneyTime';

type StatsKwargs = {
  /**
   * The uid of the journey to get stats for
   */
  journeyUid: string;

  /**
   * The JWT for the journey to get stats for
   */
  journeyJwt: string;

  /**
   * The duration of the journey in seconds
   */
  journeyDurationSeconds: number;

  /**
   * The prompt for the journey, used to initialize stats
   */
  journeyPrompt: Prompt;

  /**
   * Our clock for the journey, so that we only push relevant statistics
   */
  journeyTime: JourneyTime;
};

/**
 * Describes a snapshot of the statistics for the journey as provided by the
 * server and converted into standard javascript types.
 */
export type JourneyStats = {
  /**
   * The number of users in the journey
   */
  users: number;

  /**
   * The total number of likes, including duplicates
   */
  likes: number;

  /**
   * If the prompt has the `numeric` style, this maps each prompt option to the
   * number of people with that response
   */
  numericActive: Map<number, number> | null;

  /**
   * If the prompt has the `press` style, this is the number of people actively
   * pressing the button
   */
  pressActive: number | null;

  /**
   * If the prompt has the `press` style, this is the number of people who have
   * ever started pressing the button
   */
  press: number | null;

  /**
   * If the prompt has the `color` style, this is the number of people who have
   * the given color selected, with index-correspondance with the prompt
   */
  colorActive: number[] | null;

  /**
   * If the prompt has the `word` style, this is the number of people who have
   * the given word selected, with index-correspondance with the prompt
   */
  wordActive: number[] | null;
};

type AugmentedJourneyStats = JourneyStats & {
  /**
   * The journey time in seconds that these stats were taken at. For example, if the
   * journey time is 2, then all journey event up to (but not including) 2 seconds
   * are included
   */
  journeyTime: number;

  /**
   * The bin width that the server is using to aggregate the statistics. For example,
   * if the bin width is 3, then we can only retrieve statistics at journeyTime
   * increments of 3 seconds.
   */
  binWidth: number;
};

/**
 * Fetches the statistics for the given journey, keeping them up-to-date
 * using the server data fetched as-needed combined with linear interpolation
 */
export const useStats = ({
  journeyUid,
  journeyJwt,
  journeyDurationSeconds,
  journeyPrompt,
  journeyTime,
}: StatsKwargs): JourneyStats => {
  const [stats, setStats] = useState<JourneyStats>({
    users: 0,
    likes: 0,
    numericActive: journeyPrompt.style === 'numeric' ? new Map() : null,
    pressActive: journeyPrompt.style === 'press' ? 0 : null,
    press: journeyPrompt.style === 'press' ? 0 : null,
    colorActive:
      journeyPrompt.style === 'color' ? new Array(journeyPrompt.colors.length).fill(0) : null,
    wordActive:
      journeyPrompt.style === 'word' ? new Array(journeyPrompt.options.length).fill(0) : null,
  });

  useEffect(() => {
    let binWidth: number | null = null; // the servers bin width, if known
    let fromBin: number | null = null; // the largest bin which is still earlier than the journey time, or 0 if the journey time <= 0
    let nextBin: number | null = null; // the next bin we want to fetch, or null if we don't know
    let availableStats: Map<number, AugmentedJourneyStats> = new Map(); // the stats we have fetched from the server, indexed by bin
    let fetchedLastBin = false; // whether we have fetched the last bin, meaning no more stats are coming
    let failures = 0;

    const fetchedStatsListeners: Set<() => void> = new Set(); // used to wakeup when new stats are fetched

    let active = true;
    const bonusCancelListeners: Set<() => void> = new Set();
    fetchStats();
    easeStats();

    const unmount = () => {
      if (!active) {
        return;
      }
      active = false;
      const cpCancelListeners = [];
      const iter = bonusCancelListeners.values();
      let next = iter.next();
      while (!next.done) {
        cpCancelListeners.push(next.value);
        next = iter.next();
      }

      for (const cancel of cpCancelListeners) {
        cancel();
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
        bonusCancelListeners.add(onCancelled);

        const onTimeChange = (lastTime: DOMHighResTimeStamp, newTime: DOMHighResTimeStamp) => {
          if (!active) {
            return;
          }
          if (newTime >= targetTime) {
            bonusCancelListeners.delete(onCancelled);

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

    function sleepUntilNewStats(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        if (fetchedLastBin) {
          reject('unmounted');
          return;
        }

        const onCancel = () => {
          bonusCancelListeners.delete(onCancel);
          fetchedStatsListeners.delete(onFetchedStats);
          reject('unmounted');
        };

        const onFetchedStats = () => {
          if (!active) {
            return;
          }
          bonusCancelListeners.delete(onCancel);
          fetchedStatsListeners.delete(onFetchedStats);
          resolve();
        };

        bonusCancelListeners.add(onCancel);
        fetchedStatsListeners.add(onFetchedStats);
      });
    }

    function sleepUntilNextTick(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        if (!active) {
          reject('unmounted');
          return;
        }
        const predictedIndex = journeyTime.onTimeChanged.current.length;
        const tryRemoveOnTick = () => {
          for (
            let i = Math.min(predictedIndex, journeyTime.onTimeChanged.current.length - 1);
            i >= 0;
            i--
          ) {
            if (journeyTime.onTimeChanged.current[i] === onTick) {
              journeyTime.onTimeChanged.current.splice(i, 1);
              return true;
            }
          }

          return false;
        };

        const onCancel = () => {
          bonusCancelListeners.delete(onCancel);
          if (!tryRemoveOnTick()) {
            reject(new Error('onTick callback not found in onTimeChanged list!'));
            return;
          }
          reject('unmounted');
        };

        const onTick = () => {
          if (!active) {
            return;
          }
          bonusCancelListeners.delete(onCancel);
          if (!tryRemoveOnTick()) {
            reject(new Error('onTick callback not found in onTimeChanged list!'));
            return;
          }
          resolve();
        };

        bonusCancelListeners.add(onCancel);
        journeyTime.onTimeChanged.current.push(onTick);
      });
    }

    function informListenersOnNewStats() {
      const cp = [];
      const iter = fetchedStatsListeners.values();
      let next = iter.next();
      while (!next.done) {
        cp.push(next.value);
        next = iter.next();
      }

      for (const listener of cp) {
        listener();
      }
    }

    async function fetchBin(bin: number): Promise<AugmentedJourneyStats> {
      const response = await fetch(
        `${HTTP_API_URL}/api/1/journeys/events/stats?${new URLSearchParams({
          uid: journeyUid,
          bin: bin.toString(),
        })}`,
        {
          method: 'GET',
          headers: {
            Authorization: `bearer ${journeyJwt}`,
          },
        }
      );

      if (!response.ok) {
        throw response;
      }

      const json = await response.json();

      return {
        journeyTime: json.journey_time,
        binWidth: json.bin_width,
        users: json.users,
        likes: json.likes,
        numericActive:
          json.numeric_active !== null
            ? new Map(
                Object.entries(json.numeric_active).map(([k, v]) => [parseInt(k), v as number])
              )
            : null,
        pressActive: json.press_active ?? null,
        press: json.press ?? null,
        colorActive: json.color_active ?? null,
        wordActive: json.word_active ?? null,
      };
    }

    async function handleFailure() {
      if (!active) {
        return;
      }

      failures += 1;
      if (failures < 5) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    async function fetchStats() {
      let worstStatsFetchTime = 0;
      while (active) {
        try {
          let startReqAt = performance.now();
          const firstBin = await fetchBin(0);
          worstStatsFetchTime = performance.now() - startReqAt;
          if (!active) {
            return;
          }

          binWidth = firstBin.binWidth;
          fromBin = Math.max(Math.floor(journeyTime.time.current / (binWidth * 1000)), 0);
          fetchedLastBin = journeyDurationSeconds <= binWidth;
          if (fromBin === 0) {
            availableStats.set(0, firstBin);
            nextBin = 1;
            informListenersOnNewStats();
          } else {
            nextBin = fromBin;
          }
          break;
        } catch (e) {
          console.error(e);
          await handleFailure();
        }
      }

      if (nextBin === null || binWidth === null) {
        unmount();
        throw new Error('assertion error');
      }

      while (active && !fetchedLastBin) {
        const startOfBeforeNextBin = (nextBin - 1) * binWidth * 1000;
        const nextBinFetchTime =
          startOfBeforeNextBin - Math.min(Math.max(worstStatsFetchTime, 500), 3500);

        if (journeyTime.time.current < nextBinFetchTime) {
          try {
            await sleepUntilJourneyTime(nextBinFetchTime);
          } catch (e) {
            if (!active) {
              return;
            }
            console.error(e);
            unmount();
            return;
          }
        }

        try {
          const reqStartAt = performance.now();
          const stats = await fetchBin(nextBin);
          const reqTime = performance.now() - reqStartAt;
          worstStatsFetchTime = Math.max(worstStatsFetchTime, reqTime);

          if (!active) {
            return;
          }

          availableStats.set(nextBin, stats);
          nextBin += 1;
          fetchedLastBin = journeyDurationSeconds <= nextBin * binWidth;
          informListenersOnNewStats();
        } catch (e) {
          console.error(e);
          await handleFailure();
        }
      }
    }

    function easeNumberBetween(a: number, b: number, progress: number) {
      return Math.round(a + (b - a) * progress);
    }

    function easeMapBetween(
      a: Map<number, number> | null,
      b: Map<number, number> | null,
      progress: number
    ) {
      if (a === undefined) {
        a = null;
      }
      if (b === undefined) {
        b = null;
      }
      if (a === null && b === null) {
        return null;
      }
      if (b === null) {
        return a;
      }
      if (a === null) {
        return b;
      }

      const result = new Map<number, number>();
      const iter = a.entries();
      let next = iter.next();
      while (!next.done) {
        const [key, value] = next.value;
        result.set(key, easeNumberBetween(value, b.get(key) ?? 0, progress));
        next = iter.next();
      }
      return result;
    }

    function easeArrayBetween(a: number[] | null, b: number[] | null, progress: number) {
      if (a === null && b === null) {
        return null;
      }
      if (b === null) {
        return a;
      }
      if (a === null) {
        return b;
      }
      const result = [];
      for (let i = 0; i < a.length; i++) {
        result.push(easeNumberBetween(a[i], b[i], progress));
      }
      return result;
    }

    function easeStatsBetween(a: JourneyStats, b: JourneyStats, progress: number) {
      return {
        users: easeNumberBetween(a.users, b.users, progress),
        likes: easeNumberBetween(a.likes, b.likes, progress),
        numericActive:
          journeyPrompt.style === 'numeric'
            ? easeMapBetween(a.numericActive!, b.numericActive!, progress)
            : null,
        pressActive:
          journeyPrompt.style === 'press'
            ? easeNumberBetween(a.pressActive!, b.pressActive!, progress)
            : null,
        press:
          journeyPrompt.style === 'press' ? easeNumberBetween(a.press!, b.press!, progress) : null,
        colorActive:
          journeyPrompt.style === 'color'
            ? easeArrayBetween(a.colorActive!, b.colorActive!, progress)
            : null,
        wordActive:
          journeyPrompt.style === 'word'
            ? easeArrayBetween(a.wordActive!, b.wordActive!, progress)
            : null,
      };
    }

    async function easeStats() {
      try {
        await sleepUntilNewStats();
      } catch (e) {
        if (!active) {
          return;
        }
        console.error(e);
        unmount();
        return;
      }

      if (binWidth === null || fromBin === null) {
        unmount();
        throw new Error('assertion error');
      }

      let lastUsedBin = fromBin;
      let oldStats: JourneyStats = {
        users: -1,
        likes: -1,
        pressActive: -1,
        press: -1,
        numericActive: null,
        colorActive: null,
        wordActive: null,
      };
      const setStatsIfDifferent = (newStats: JourneyStats) => {
        if (
          oldStats.users !== newStats.users ||
          oldStats.likes !== newStats.likes ||
          oldStats.pressActive !== newStats.pressActive ||
          oldStats.press !== newStats.press ||
          !mapEquals(oldStats.numericActive, newStats.numericActive) ||
          !arrayEquals(oldStats.colorActive, newStats.colorActive) ||
          !arrayEquals(oldStats.wordActive, newStats.wordActive)
        ) {
          setStats(newStats);
          oldStats = newStats;
        }
      };

      while (active && journeyTime.time.current <= journeyDurationSeconds * 1000) {
        const easeFromBin = Math.max(Math.floor(journeyTime.time.current / (binWidth * 1000)), 0);
        const easeToBin = easeFromBin + 1;
        const progress = Math.max(
          (journeyTime.time.current - easeFromBin * binWidth * 1000) / (binWidth * 1000),
          0
        );

        while (easeFromBin > lastUsedBin) {
          availableStats.delete(lastUsedBin);
          lastUsedBin++;
        }

        if (availableStats.has(easeFromBin) && availableStats.has(easeToBin)) {
          setStatsIfDifferent(
            easeStatsBetween(
              availableStats.get(easeFromBin)!,
              availableStats.get(easeToBin)!,
              progress
            )
          );
          try {
            await sleepUntilNextTick();
          } catch (e) {
            if (!active) {
              return;
            }
            console.error(e);
            unmount();
            return;
          }
          continue;
        }

        if (availableStats.has(easeFromBin)) {
          setStatsIfDifferent(availableStats.get(easeFromBin)!);
          // fall through to wait for new stats
        }

        if (fetchedLastBin) {
          unmount();
          return;
        }

        try {
          await sleepUntilNewStats();
        } catch (e) {
          if (!active) {
            return;
          }
          console.error(e);
          unmount();
          return;
        }
      }
    }
  }, [
    journeyUid,
    journeyJwt,
    journeyDurationSeconds,
    journeyPrompt,
    journeyTime.onTimeChanged,
    journeyTime.time,
  ]);

  return stats;
};

function arrayEquals<T>(a: T[] | null | undefined, b: T[] | null | undefined): boolean {
  if (a === b) {
    return true;
  }

  if (a === undefined || b === undefined || a === null || b === null) {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function mapEquals<A, B>(
  a: Map<A, B> | null | undefined,
  b: Map<A, B> | null | undefined
): boolean {
  if (a === b) {
    return true;
  }

  if (a === undefined || b === undefined || a === null || b === null) {
    return false;
  }

  if (a.size !== b.size) {
    return false;
  }

  const iter = a.entries();
  let next = iter.next();
  while (!next.done) {
    const [key, value] = next.value;
    if (value !== b.get(key)) {
      return false;
    }
    next = iter.next();
  }
  return true;
}
