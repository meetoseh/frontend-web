import { useEffect } from 'react';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { PromptTime } from './usePromptTime';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../../../shared/anim/VariableStrategyProps';

type UseIndexableFakeMoveProps = {
  /**
   * The current time
   */
  promptTime: VariableStrategyProps<PromptTime>;
  /**
   * The current distribution of responses as an array of numbers,
   * where the length of the responses is the number of options,
   * and the value of each element is the number of people
   * currently responding with that value.
   */
  responses: VariableStrategyProps<number[]>;
  /**
   * The current selection. When the selection changes, we briefly
   * increase the number of people responding with the selected value
   * and decrease the number of people with the old value.
   */
  selection: VariableStrategyProps<number | null>;
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
 * A react hook which returns the client-side predicted response distribution
 * for a prompt whose responses can be described as a fixed finite number of
 * discrete options.
 */
export const useIndexableFakeMove = ({
  promptTime: promptTimeVariableStrategy,
  responses: responsesVariableStrategy,
  selection: selectionVariableStrategy,
}: UseIndexableFakeMoveProps): ValueWithCallbacks<number[]> => {
  const promptTimeVWC = useVariableStrategyPropsAsValueWithCallbacks(promptTimeVariableStrategy);
  const responsesVWC = useVariableStrategyPropsAsValueWithCallbacks(responsesVariableStrategy);
  const selectionVWC = useVariableStrategyPropsAsValueWithCallbacks(selectionVariableStrategy);
  const clientPredictedStats = useWritableValueWithCallbacks<number[]>(() => responsesVWC.get());
  useEffect(() => {
    let fakedMove: _FakedMove | null = null;
    /**
     * The index of the selected value we think the stats currently reflect
     */
    let serverSelected: number | null = selectionVWC.get();
    selectionVWC.callbacks.add(handleSelectionChanged);
    responsesVWC.callbacks.add(handleStatsChanged);
    promptTimeVWC.callbacks.add(handleTimeChanged);
    updatePredictedStats();

    return () => {
      selectionVWC.callbacks.remove(handleSelectionChanged);
      responsesVWC.callbacks.remove(handleStatsChanged);
      promptTimeVWC.callbacks.remove(handleTimeChanged);
    };

    function updatePredictedStats() {
      const responses = responsesVWC.get();
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
      const responses = responsesVWC.get();
      if (responses === undefined) {
        fakedMove = null;
        serverSelected = selectionVWC.get();
        updatePredictedStats();
        return;
      }

      const nowSelected = selectionVWC.get();
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
                promptTimeToCancel: promptTimeVWC.get().time + 4500,
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
              promptTimeToCancel: promptTimeVWC.get().time + 4500,
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

    function handleTimeChanged() {
      const now = promptTimeVWC.get().time;
      if (fakedMove === null || fakedMove.promptTimeToCancel > now) {
        return;
      }

      serverSelected = fakedMove.selecting;
      fakedMove = null;
      updatePredictedStats();
    }
  }, [promptTimeVWC, responsesVWC, selectionVWC, clientPredictedStats]);
  return clientPredictedStats;
};
