import { MutableRefObject, useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '../../../shared/ApiConstants';
import { Callbacks } from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { InteractivePrompt } from '../models/InteractivePrompt';
import { PromptTime, waitUntilUsingPromptTime } from './usePromptTime';

/**
 * Describes a generally mutable object that provides a snapshot of the
 * currrent state of the prompt.
 */
export type Stats = {
  /**
   * The time in milliseconds since the start of the prompt these stats
   * are for, either as recorded by the server or as interpolated by the
   * client.
   */
  promptTime: number;

  /**
   * The width between consecutive bins on the server, in milliseconds. For
   * example, if this is 2000, that means that there is a snapshot available
   * at 0, 2000, 4000, etc, and other prompt times are interpolated.
   */
  binWidth: number;

  /**
   * The number of users in the interactive prompt
   */
  users: number;

  /**
   * The number of likes in the interactive prompt
   */
  likes: number;

  /**
   * If the interactive prompt is the `numeric` style, this is a map with
   * the same length as the number of possible ratings, where each entry
   * corresponds to the number of people responding with that rating.
   *
   * For example, for a numeric prompt with min: 1, max: 5, step: 1, this
   * would be a a map with keys 1, 2, 3, 4, 5, and values corresponding to
   * the number of people who have rated the prompt with that value.
   */
  numericActive: Map<number, number> | null;

  /**
   * If the interactive prompt is the `press` style, this is the number of
   * people currently pressing the button.
   */
  pressActive: number | null;

  /**
   * If the interactive prompt is the `press` style, this is the number of
   * times the button has been pressed.
   */
  press: number | null;

  /**
   * If the interactive prompt is the `color` style, this is a list with
   * the same length as the number of possible colors, where each entry
   * corresponds to the number of people responding with that color,
   * in index-correspondance with the colors list.
   */
  colorActive: number[] | null;

  /**
   * Tf the interactive prompt is the `word` style, this is the list with
   * the same length as the number of possible words, where each entry
   * corresponds to the number of people responding with that word,
   * in index-correspondance with the words list.
   */
  wordActive: number[] | null;
};

export type StatsChangedEvent = {
  /**
   * The stats before the change.
   */
  old: Stats;

  /**
   * The stats after the change.
   */
  current: Stats;
};

/**
 * Describes the stats for an interactive prompt. The stats come from the
 * backend at 2s increments, but we interpolate the value between those
 * points, so it updates fairly often. Hence the current value of the stats
 * is available as a ref with a callbacks list which can be used to either
 * update components without a rerender (preferable for performance), or
 * to trigger a rerender.
 */
export type PromptStats = {
  /**
   * The current snapshot of stats, as interpolated by the client.
   */
  stats: MutableRefObject<Stats>;

  /**
   * Contains the functions to call when the stats change, called once
   * per frame.
   */
  onStatsChanged: MutableRefObject<Callbacks<StatsChangedEvent>>;
};

type UseStatsProps = {
  /**
   * The uid of the interactive prompt to fetch stats for
   */
  prompt: InteractivePrompt;
  /**
   * The prompt time we sync up the stats to
   */
  promptTime: PromptTime;
};

/**
 * Fetches stats in the background, syncing them with the prompt time. The
 * returned object is stable as the underlying stats are mutated rather than
 * replaced.
 */
export const useStats = ({ prompt, promptTime }: UseStatsProps): PromptStats => {
  const stats = useRef<Stats>() as MutableRefObject<Stats>;
  const onStatsChanged = useRef<Callbacks<StatsChangedEvent>>() as MutableRefObject<
    Callbacks<StatsChangedEvent>
  >;

  if (stats.current === undefined) {
    stats.current = {
      promptTime: promptTime.time.current,
      binWidth: 0,
      users: 0,
      likes: 0,
      numericActive: null,
      pressActive: null,
      press: null,
      colorActive: null,
      wordActive: null,
    };
  }

  if (onStatsChanged.current === undefined) {
    onStatsChanged.current = new Callbacks();
  }

  useEffect(() => {
    if (prompt.durationSeconds <= 0) {
      return;
    }

    let active = true;
    handleStats()
      .catch((e) => {
        if (!active) {
          return;
        }
        console.error('Error loading stats', e);
      })
      .finally(() => {
        active = false;
      });
    return () => {
      active = false;
    };

    function setStats(newStats: Stats) {
      const old = stats.current;
      stats.current = newStats;
      onStatsChanged.current.call({ old, current: newStats });
    }

    async function handleStats() {
      const firstBin = await loadStats(0);
      const binWidth = firstBin.binWidth * 1000;

      const bins: Map<number, { loaded: true; stats: Stats } | { loaded: false }> = new Map();

      while (active) {
        const now = promptTime.time.current;
        if (now >= prompt.durationSeconds * 1000) {
          return;
        }

        const desiredBins = getDesiredBins(prompt.durationSeconds * 1000, binWidth, now);
        for (let i = 0; i < desiredBins.length; i++) {
          if (!bins.has(desiredBins[i])) {
            bins.set(desiredBins[i], { loaded: false });
            (async (bin) => {
              const stats = await loadStats(bin);
              if (!bins.has(bin)) {
                return;
              }

              bins.set(bin, { loaded: true, stats });
            })(desiredBins[i]);
          }
        }

        if (bins.size !== desiredBins.length) {
          const desiredLookup = new Set(desiredBins);
          const toDelete: number[] = [];
          bins.forEach((_, bin) => {
            if (!desiredLookup.has(bin)) {
              toDelete.push(bin);
            }
          });
          for (const bin of toDelete) {
            bins.delete(bin);
          }
        }

        const easeFromBin = getEaseFromBin(prompt.durationSeconds * 1000, binWidth, now);
        const easeToBin = getEaseToBin(prompt.durationSeconds * 1000, binWidth, now);

        const easeFromRaw = bins.get(easeFromBin);
        const easeToRaw = bins.get(easeToBin);

        if (easeFromRaw === undefined || easeToRaw === undefined) {
          throw new Error('Could not find bins');
        }

        if (easeFromRaw.loaded && easeToRaw.loaded) {
          const binStartsAt = getBinStart(prompt.durationSeconds * 1000, binWidth, easeToBin);
          const binEndsAt = getBinEnd(prompt.durationSeconds * 1000, binWidth, easeToBin);
          const progress = Math.min(
            1,
            Math.max(0, (now - binStartsAt) / (binEndsAt - binStartsAt))
          );
          setStats(interpolate(easeFromRaw.stats, easeToRaw.stats, progress));
        }
        await waitUntilUsingPromptTime(promptTime, () => true);
      }
    }

    async function loadStats(bin: number, attempt?: number): Promise<Stats> {
      if (!active) {
        throw new Error('Cancelled');
      }

      const attemptN = attempt ?? 0;
      try {
        return await loadStatsInner(bin);
      } catch (e) {
        if (attemptN < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attemptN));
          return await loadStats(bin, attemptN + 1);
        } else {
          throw e;
        }
      }
    }

    async function loadStatsInner(bin: number): Promise<Stats> {
      const response = await apiFetch(
        '/api/1/interactive_prompts/events/stats?' +
          new URLSearchParams({
            uid: prompt.uid,
            bin: bin.toString(),
          }),
        {
          method: 'GET',
          headers: {
            Authorization: `bearer ${prompt.jwt}`,
          },
        },
        null
      );

      if (!response.ok) {
        throw response;
      }

      const data = await response.json();
      return {
        promptTime: data.prompt_time,
        binWidth: data.bin_width,
        users: data.users,
        likes: data.likes,
        numericActive: data.numeric_active
          ? (() => {
              const result = new Map<number, number>();
              for (const [key, value] of Object.entries(data.numeric_active)) {
                result.set(parseInt(key), value as number);
              }
              return result;
            })()
          : null,
        pressActive: data.press_active,
        press: data.press,
        colorActive: data.color_active,
        wordActive: data.word_active,
      };
    }
  }, [prompt, promptTime]);

  return useMemo(
    () => ({
      stats,
      onStatsChanged,
    }),
    []
  );
};

/**
 * Convenience function which adapts the statsChanged event to a promise.
 */
export const waitUntilNextStatsUpdate = (stats: PromptStats): Promise<StatsChangedEvent> => {
  return new Promise<StatsChangedEvent>((resolve) => {
    const onChanged = (event: StatsChangedEvent) => {
      stats.onStatsChanged.current.remove(onChanged);
      resolve(event);
    };

    stats.onStatsChanged.current.add(onChanged);
  });
};

/**
 * Convenience function which adapts the statsChanged event to a cancelable promise
 */
export const waitUntilNextStatsUpdateCancelable = (
  stats: PromptStats
): CancelablePromise<StatsChangedEvent> => {
  let active = true;
  let cancel: () => void = () => {
    active = false;
  };
  const promise = new Promise<StatsChangedEvent>((resolve, reject) => {
    if (!active) {
      reject();
      return;
    }

    const onChanged = (event: StatsChangedEvent) => {
      if (!active) {
        return;
      }

      stats.onStatsChanged.current.remove(onChanged);
      active = false;
      resolve(event);
    };

    cancel = () => {
      if (!active) {
        return;
      }

      stats.onStatsChanged.current.remove(onChanged);
      active = false;
      reject();
    };

    stats.onStatsChanged.current.add(onChanged);
  });

  return {
    promise,
    cancel: () => cancel(),
    done: () => !active,
  };
};

const interpolate = (from: Stats | null, to: Stats | null, progress: number): Stats => {
  const users = Math.round((from?.users ?? 0) + ((to?.users ?? 0) - (from?.users ?? 0)) * progress);
  const likes = Math.round((from?.likes ?? 0) + ((to?.likes ?? 0) - (from?.likes ?? 0)) * progress);
  const press =
    from?.press || to?.press
      ? Math.round((from?.press ?? 0) + ((to?.press ?? 0) - (from?.press ?? 0)) * progress)
      : null;
  const pressActive =
    from?.pressActive || to?.pressActive
      ? Math.round(
          (from?.pressActive ?? 0) + ((to?.pressActive ?? 0) - (from?.pressActive ?? 0)) * progress
        )
      : null;

  let numericActive: Map<number, number> | null = null;
  if (from?.numericActive || to?.numericActive) {
    numericActive = new Map();

    if (from?.numericActive) {
      const iter = from.numericActive.entries();
      let next = iter.next();
      while (!next.done) {
        const [key, value] = next.value;
        numericActive.set(key, value);
        next = iter.next();
      }
    }

    if (to?.numericActive) {
      const iter = to.numericActive.entries();
      let next = iter.next();
      while (!next.done) {
        const [key, value] = next.value;
        const fromValue = numericActive.get(key) ?? 0;
        numericActive.set(key, Math.round(fromValue + (value - fromValue) * progress));
        next = iter.next();
      }
    }
  }

  let colorActive: number[] | null = null;
  if (from?.colorActive || to?.colorActive) {
    const fromLen = from?.colorActive?.length ?? 0;
    const toLen = to?.colorActive?.length ?? 0;
    const resLen = Math.max(fromLen, toLen);

    colorActive = [];
    for (let i = 0; i < resLen; i++) {
      const fromVal = from?.colorActive?.[i] ?? 0;
      const toVal = to?.colorActive?.[i] ?? 0;
      colorActive[i] = Math.round(fromVal + (toVal - fromVal) * progress);
    }
  }

  let wordActive: number[] | null = null;
  if (from?.wordActive || to?.wordActive) {
    const fromLen = from?.wordActive?.length ?? 0;
    const toLen = to?.wordActive?.length ?? 0;
    const resLen = Math.max(fromLen, toLen);

    wordActive = [];
    for (let i = 0; i < resLen; i++) {
      const fromVal = from?.wordActive?.[i] ?? 0;
      const toVal = to?.wordActive?.[i] ?? 0;
      wordActive[i] = Math.round(fromVal + (toVal - fromVal) * progress);
    }
  }

  return {
    promptTime:
      (from?.promptTime ?? 0) + ((to?.promptTime ?? 0) - (from?.promptTime ?? 0)) * progress,
    binWidth: from?.binWidth || to?.binWidth || 0,
    users,
    likes,
    numericActive,
    pressActive,
    press,
    colorActive,
    wordActive,
  };
};

const getEaseFromBin = (promptDuration: number, binWidth: number, promptTime: number): number => {
  const totalNumberOfBins = Math.ceil(promptDuration / binWidth);
  const result = Math.max(0, Math.floor(promptTime / binWidth) - 1);
  return Math.min(result, totalNumberOfBins - 1);
};

const getEaseToBin = (promptDuration: number, binWidth: number, promptTime: number): number => {
  const totalNumberOfBins = Math.ceil(promptDuration / binWidth);
  const result = getEaseFromBin(promptDuration, binWidth, promptTime) + 1;
  return Math.min(result, totalNumberOfBins - 1);
};

const getBinStart = (promptDuration: number, binWidth: number, bin: number): number => {
  return bin * binWidth;
};

const getBinEnd = (promptDuration: number, binWidth: number, bin: number): number => {
  return Math.min((bin + 1) * binWidth, promptDuration);
};

const getDesiredBins = (promptDuration: number, binWidth: number, promptTime: number): number[] => {
  const totalNumberOfBins = Math.ceil(promptDuration / binWidth);
  const firstBinToInclude = getEaseFromBin(promptDuration, binWidth, promptTime);
  const result = [];
  for (let i = 0; i < 3 && firstBinToInclude + i < totalNumberOfBins; i++) {
    result.push(firstBinToInclude + i);
  }
  return result;
};
