import { useEffect } from 'react';
import { apiFetch } from '../../../shared/ApiConstants';
import {
  Callbacks,
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { InteractivePrompt } from '../models/InteractivePrompt';
import { PromptTime } from './usePromptTime';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../../../shared/anim/VariableStrategyProps';
import { waitForValueWithCallbacksConditionCancelable } from '../../../shared/lib/waitForValueWithCallbacksCondition';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { createCancelablePromiseFromCallbacks } from '../../../shared/lib/createCancelablePromiseFromCallbacks';

export type UseStatsProps = {
  /**
   * The interactive prompt to fetch stats for
   */
  prompt: VariableStrategyProps<InteractivePrompt>;

  /**
   * The prompt time we sync up the stats to
   */
  promptTime: VariableStrategyProps<PromptTime>;
};

/**
 * Describes a generally mutable object that provides a snapshot of the
 * current state of the prompt.
 */
export type Stats = {
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

/**
 * Fetches stats, syncing them with the prompt time. This is designed to leave
 * open the possibility of client interpolation. In the past, this actually did
 * perform such interpolation, but with the animations we have now, it looks
 * better (and is faster) to use those instead. Furthermore, that reduces the
 * time spent animating which allows for smarter placement of when images are
 * loaded. This is especially important on devices with very few available
 * cores, such as budget phones, where loading images can cause animations to
 * stutter even if those images aren't being displayed yet.
 */
export const useStats = ({
  prompt: promptVariableStrategy,
  promptTime: promptTimeVariableStrategy,
}: UseStatsProps): ValueWithCallbacks<Stats> => {
  const promptVWC = useVariableStrategyPropsAsValueWithCallbacks(promptVariableStrategy);
  const promptTimeVWC = useVariableStrategyPropsAsValueWithCallbacks(promptTimeVariableStrategy);
  const stats = useWritableValueWithCallbacks<Stats>(() => ({
    binWidth: 0,
    users: 0,
    likes: 0,
    numericActive: null,
    pressActive: null,
    press: null,
    colorActive: null,
    wordActive: null,
  }));

  useEffect(() => {
    let managingPrompt: InteractivePrompt | null = null;
    let managingPromptTimeVWC: WritableValueWithCallbacks<PromptTime> | null = null;
    let canceler: (() => void) | null = null;
    promptVWC.callbacks.add(handlePropsChanged);
    promptTimeVWC.callbacks.add(handlePropsChanged);
    handlePropsChanged();
    return () => {
      promptVWC.callbacks.remove(handlePropsChanged);
      promptTimeVWC.callbacks.remove(handlePropsChanged);
      canceler?.();
    };

    function handlePrompt(
      prompt: InteractivePrompt,
      promptTimeVWC: ValueWithCallbacks<PromptTime>
    ): (() => void) | null {
      let active = true;
      const canceled = new Callbacks<undefined>();
      handle();
      return () => {
        if (active) {
          active = false;
          canceled.call(undefined);
        }
      };

      async function handle() {
        const binLoaded = new Callbacks<undefined>();
        const firstBin = await loadStats(0);
        const binWidth = firstBin.binWidth * 1000;

        const bins: Map<number, { loaded: true; stats: Stats } | { loaded: false }> = new Map();
        bins.set(0, { loaded: true, stats: firstBin });

        while (active) {
          const now = promptTimeVWC.get().time;
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
                binLoaded.call(undefined);
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
          const easeFromRaw = bins.get(easeFromBin);
          if (easeFromRaw === undefined) {
            throw new Error('Unexpected failed to find bin');
          }

          let statsLoadedPromise: CancelablePromise<void> | null = null;
          if (easeFromRaw.loaded) {
            stats.set(easeFromRaw.stats);
            stats.callbacks.call(undefined);
          } else {
            statsLoadedPromise = createCancelablePromiseFromCallbacks(binLoaded);
          }

          const cancelableTimePromise = waitForValueWithCallbacksConditionCancelable(
            promptTimeVWC,
            (v) =>
              v.time >= prompt.durationSeconds * 1000 ||
              getEaseFromBin(prompt.durationSeconds * 1000, binWidth, v.time) !== easeFromBin
          );
          canceled.add(cancelableTimePromise.cancel);
          if (statsLoadedPromise !== null) {
            canceled.add(statsLoadedPromise.cancel);
            await Promise.race([
              cancelableTimePromise.promise.catch(() => {}),
              statsLoadedPromise.promise.catch(() => {}),
            ]);
            canceled.remove(statsLoadedPromise.cancel);
            cancelableTimePromise.cancel();
            statsLoadedPromise.cancel();
          } else {
            await cancelableTimePromise.promise.catch(() => {});
          }
          canceled.remove(cancelableTimePromise.cancel);
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
    }

    function handlePropsChanged() {
      const prompt = promptVWC.get();
      const promptTime = promptTimeVWC.get();

      if (
        managingPrompt !== null &&
        managingPrompt.uid === prompt.uid &&
        managingPromptTimeVWC !== null
      ) {
        managingPromptTimeVWC.set(promptTime);
        managingPromptTimeVWC.callbacks.call(undefined);
        return;
      }

      canceler?.();
      managingPrompt = prompt;
      managingPromptTimeVWC = createWritableValueWithCallbacks(promptTime);
      canceler = handlePrompt(prompt, managingPromptTimeVWC);
    }
  }, [promptVWC, promptTimeVWC, stats]);

  return stats;
};

const getEaseFromBin = (promptDuration: number, binWidth: number, promptTime: number): number => {
  const totalNumberOfBins = Math.ceil(promptDuration / binWidth);
  const result = Math.max(0, Math.floor(promptTime / binWidth) - 1);
  return Math.min(result, totalNumberOfBins - 1);
};

/*
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
*/

const getDesiredBins = (promptDuration: number, binWidth: number, promptTime: number): number[] => {
  const totalNumberOfBins = Math.ceil(promptDuration / binWidth);
  const firstBinToInclude = getEaseFromBin(promptDuration, binWidth, promptTime);
  const result = [];
  for (let i = 0; i < 3 && firstBinToInclude + i < totalNumberOfBins; i++) {
    result.push(firstBinToInclude + i);
  }
  return result;
};
