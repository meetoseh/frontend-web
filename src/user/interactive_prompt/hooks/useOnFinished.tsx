import { useEffect, useMemo } from 'react';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../../../shared/anim/VariableStrategyProps';
import { useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { JoinLeave } from './useJoinLeave';
import { PromptTime } from './usePromptTime';
import { PromptOnFinished } from '../models/PromptOnFinished';

export function useOnFinished<T>({
  joinLeave: joinLeaveVariableStrategy,
  promptTime: promptTimeVariableStrategy,
  selection: selectionVariableStrategy,
  onFinished,
}: {
  joinLeave: VariableStrategyProps<JoinLeave>;
  promptTime: VariableStrategyProps<PromptTime>;
  selection: VariableStrategyProps<T>;
  onFinished: PromptOnFinished<T>;
}): {
  onSkip: () => void;
} {
  const joinLeaveVWC = useVariableStrategyPropsAsValueWithCallbacks(joinLeaveVariableStrategy);
  const promptTimeVWC = useVariableStrategyPropsAsValueWithCallbacks(promptTimeVariableStrategy);
  const selectionVWC = useVariableStrategyPropsAsValueWithCallbacks(selectionVariableStrategy);
  const finished = useWritableValueWithCallbacks<boolean>(() => false);

  useEffect(() => {
    if (finished.get()) {
      return;
    }

    let active = true;
    joinLeaveVWC.callbacks.add(handleJoinLeaveChanged);
    finished.callbacks.add(handleFinishedChanged);
    const unmount = () => {
      if (active) {
        active = false;
        joinLeaveVWC.callbacks.remove(handleJoinLeaveChanged);
        finished.callbacks.remove(handleFinishedChanged);
      }
    };
    handleJoinLeaveChanged();
    return unmount;

    function handleJoinLeaveChanged() {
      if (!active || finished.get()) {
        return;
      }

      if (joinLeaveVWC.get().leaving) {
        unmount();
        finished.set(true);
        finished.callbacks.call(undefined);
        onFinished(false, 'time', promptTimeVWC.get(), selectionVWC.get());
      }
    }

    function handleFinishedChanged() {
      if (finished.get()) {
        unmount();
      }
    }
  }, [joinLeaveVWC, promptTimeVWC, selectionVWC, finished, onFinished]);

  return useMemo(
    () => ({
      onSkip: () => {
        if (finished.get()) {
          return;
        }
        finished.set(true);
        finished.callbacks.call(undefined);

        onFinished(true, 'skip', promptTimeVWC.get(), selectionVWC.get());
      },
    }),
    [finished, promptTimeVWC, selectionVWC, onFinished]
  );
}
