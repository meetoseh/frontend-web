import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import { setVWC } from '../lib/setVWC';
import { useValueWithCallbacksEffect } from './useValueWithCallbacksEffect';

/**
 * Returns the given vwc but with changes delayed by the given amount, merging
 * changes that occur within the delay period into a single update. AKA debouncing.
 */
export const useDelayedValueWithCallbacks = <T>(
  vwc: ValueWithCallbacks<T>,
  delayMs: number
): ValueWithCallbacks<T> => {
  const result = useWritableValueWithCallbacks(() => vwc.get());

  useValueWithCallbacksEffect(vwc, (newValue) => {
    let timeout: NodeJS.Timeout | null = setTimeout(() => {
      timeout = null;
      setVWC(result, newValue);
    }, delayMs);

    return () => {
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    };
  });

  return result;
};
