import { useCallback } from 'react';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../anim/VariableStrategyProps';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import { useValueWithCallbacksEffect } from './useValueWithCallbacksEffect';

/**
 * Provides true until the given time, then provides false. If the time
 * is undefined, provides false.
 *
 * @param time The time, or undefined to yield false.
 * @returns True until the given time, then false.
 */
export const useBeforeTime = (
  timeVariableStrategy: VariableStrategyProps<number | undefined>
): ValueWithCallbacks<boolean> => {
  const timeVWC = useVariableStrategyPropsAsValueWithCallbacks(timeVariableStrategy);
  const showVWC = useWritableValueWithCallbacks(() => {
    const time = timeVWC.get();
    return time !== undefined && time > Date.now();
  });

  useValueWithCallbacksEffect(
    timeVWC,
    useCallback(
      (time: number | undefined) => {
        if (time === undefined) {
          if (showVWC.get()) {
            showVWC.set(false);
            showVWC.callbacks.call(undefined);
          }
          return;
        }

        const now = Date.now();
        if (now >= time) {
          if (showVWC.get()) {
            showVWC.set(false);
            showVWC.callbacks.call(undefined);
          }
          return;
        }

        if (!showVWC.get()) {
          showVWC.set(true);
          showVWC.callbacks.call(undefined);
        }
        let timeout: NodeJS.Timeout | null = setTimeout(() => {
          timeout = null;
          if (showVWC.get()) {
            showVWC.set(false);
            showVWC.callbacks.call(undefined);
          }
        }, time - now);
        return () => {
          if (timeout !== null) {
            clearTimeout(timeout);
            timeout = null;
          }
        };
      },
      [showVWC]
    )
  );

  return showVWC;
};
