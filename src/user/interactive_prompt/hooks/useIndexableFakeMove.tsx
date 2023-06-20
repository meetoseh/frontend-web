import { useEffect } from 'react';
import { WritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { PromptTime, PromptTimeEvent } from './usePromptTime';
import { SimpleSelectionRef } from './useSimpleSelection';
import { PromptStats, Stats } from './useStats';

type UseIndexableFakeMoveProps = {
  /**
   * Fetches the distribution of responses for the prompt as an array
   * of numbers, where the length of the response is the number of
   * responses, and the value of each element is the number of people
   * currently responding with that value.
   * @param stats The stats to fetch the responses from.
   * @return The distribution of responses, or undefined if the
   *   distribution is not available.
   */
  getResponses: (stats: Stats) => number[] | undefined;
  /**
   * The prompt time object which will allow us to subscribe to the time
   * changing, which is used for timing out the fake move in some circumstances.
   */
  promptTime: PromptTime;
  /**
   * The prompt stats object which will allow us to subscribe to the
   * stats changing
   */
  promptStats: PromptStats;
  /**
   * The current selection. When the selection changes, we briefly
   * increase the number of people responding with the selected value
   * and decrease the number of people with the old value.
   */
  selection: SimpleSelectionRef<number>;
  /**
   * The client-side predicted stats to mutate. This is just the result of
   * getResponses, shifted by the fake move, and hence should be interpreted
   * just like getResponses.
   */
  clientPredictedStats: WritableValueWithCallbacks<number[]>;
};

type _FakedMove = {
  /**
   * The index that will be selected when the fake move is complete.
   */
  selecting: number | null;
  /**
   * If we are lowering the value of one option by 1, the index of the option whose
   * value we are lowering. Otherwise, null.
   */
  loweringIndex: number | null;
  /**
   * If loweringIndex's total falls to or below this value, we remove the lowering
   * effect. Otherwise, null.
   */
  loweringIndexUpperTrigger: number | null;
  /**
   * If we are raising the value of one option by 1, the index of the option whose
   * value we are raising. Otherwise, null.
   */
  raisingIndex: number | null;
  /**
   * If raisingIndex's total rises to or above this value, we remove the raising
   * effect. Otherwise, null.
   */
  raisingIndexLowerTrigger: number | null;
  /**
   * The time at which we should remove the fake move regardless of the triggers
   */
  promptTimeToCancel: number;
};

/**
 * A react hook to mutate the client predicted stats when the selection changes
 * or when the stats change.
 */
export const useIndexableFakeMove = ({
  getResponses,
  promptTime,
  promptStats,
  selection,
  clientPredictedStats,
}: UseIndexableFakeMoveProps) => {
  useEffect(() => {
    let fakedMove: _FakedMove | null = null;
    /**
     * The index of the selected value we think the stats currently reflect
     */
    let serverSelected: number | null = selection.selection.current;
    selection.onSelectionChanged.current.add(handleSelectionChanged);
    promptStats.onStatsChanged.current.add(handleStatsChanged);
    promptTime.onTimeChanged.current.add(handleTimeChanged);
    updatePredictedStats();

    return () => {
      selection.onSelectionChanged.current.remove(handleSelectionChanged);
      promptStats.onStatsChanged.current.remove(handleStatsChanged);
      promptTime.onTimeChanged.current.remove(handleTimeChanged);
    };

    function updatePredictedStats() {
      const responses = getResponses(promptStats.stats.current);
      if (responses === undefined) {
        return;
      }

      const newPredictedStats = [...responses];
      if (fakedMove !== null) {
        if (fakedMove.loweringIndex !== null) {
          if (
            fakedMove.loweringIndexUpperTrigger !== null &&
            responses[fakedMove.loweringIndex] <= fakedMove.loweringIndexUpperTrigger
          ) {
            fakedMove.loweringIndex = null;
            fakedMove.loweringIndexUpperTrigger = null;
          } else {
            newPredictedStats[fakedMove.loweringIndex] -= 1;
          }
        }

        if (fakedMove.raisingIndex !== null) {
          if (
            fakedMove.raisingIndexLowerTrigger !== null &&
            responses[fakedMove.raisingIndex] >= fakedMove.raisingIndexLowerTrigger
          ) {
            fakedMove.raisingIndex = null;
            fakedMove.raisingIndexLowerTrigger = null;
          } else {
            newPredictedStats[fakedMove.raisingIndex] += 1;
          }
        }

        if (fakedMove.raisingIndex === null && fakedMove.loweringIndex === null) {
          serverSelected = fakedMove.selecting;
          fakedMove = null;
        }
      }

      clientPredictedStats.set(newPredictedStats);
      clientPredictedStats.callbacks.call(undefined);
    }

    function handleSelectionChanged() {
      const responses = getResponses(promptStats.stats.current);

      if (responses === undefined) {
        fakedMove = null;
        serverSelected = selection.selection.current;
        updatePredictedStats();
        return;
      }

      const nowSelected = selection.selection.current;
      if (nowSelected === null) {
        fakedMove =
          serverSelected === null || responses[serverSelected] < 1
            ? null
            : {
                selecting: null,
                raisingIndex: null,
                raisingIndexLowerTrigger: null,
                loweringIndex: serverSelected,
                loweringIndexUpperTrigger: responses[serverSelected] - 1,
                promptTimeToCancel: promptTime.time.current + 4500,
              };
        updatePredictedStats();
        return;
      }

      const newMove: _FakedMove | null =
        nowSelected === serverSelected
          ? null
          : {
              selecting: nowSelected,
              loweringIndex: null,
              loweringIndexUpperTrigger: null,
              raisingIndex: nowSelected,
              raisingIndexLowerTrigger: responses[nowSelected] + 1,
              promptTimeToCancel: promptTime.time.current + 4500,
            };

      if (newMove !== null && serverSelected !== null && responses[serverSelected] >= 1) {
        newMove.loweringIndex = serverSelected;
        newMove.loweringIndexUpperTrigger = responses[serverSelected] - 1;
      }

      fakedMove = newMove;
      updatePredictedStats();
    }

    function handleStatsChanged() {
      updatePredictedStats();
    }

    function handleTimeChanged(e: PromptTimeEvent) {
      if (fakedMove === null || fakedMove.promptTimeToCancel > e.current) {
        return;
      }

      serverSelected = fakedMove.selecting;
      fakedMove = null;
      updatePredictedStats();
    }
  }, [getResponses, promptTime, promptStats, selection, clientPredictedStats]);
};
