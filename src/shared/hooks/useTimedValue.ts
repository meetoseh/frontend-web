import { useEffect, useRef } from 'react';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import { setVWC } from '../lib/setVWC';
import { useUnwrappedValueWithCallbacks } from './useUnwrappedValueWithCallbacks';

/**
 * A basic hook which provides the first value for the given duration, then
 * switches to the second value.
 *
 * This will trigger a rerender once, at the time of the switch, unless the
 * parameters change. To avoid rerenders, use the `useTimedValueWithCallbacks` hook.
 *
 * @param originalValue The initial value to use.
 * @param switchesToValue The value to switch to after the given delay.
 * @param delayMS The delay in milliseconds before switching to the second value.
 */
export function useTimedValue<T>(originalValue: T, switchesToValue: T, delayMS: number): T {
  return useUnwrappedValueWithCallbacks(
    useTimedValueWithCallbacks(originalValue, switchesToValue, delayMS)
  );
}

/**
 * A basic hook which provides the first value for the given duration, then
 * switches to the second value. The returned value is a value with callbacks
 * to avoid react rerenders.
 *
 * @param originalValue The initial value to use.
 * @param switchesToValue The value to switch to after the given delay.
 * @param delayMS The delay in milliseconds before switching to the second value.
 */
export function useTimedValueWithCallbacks<T>(
  originalValue: T,
  switchesToValue: T,
  delayMS: number
): ValueWithCallbacks<T> {
  const value = useWritableValueWithCallbacks(() => originalValue);
  const timeoutStartedAt = useRef<number | null>(null);

  useEffect(() => {
    const now = Date.now();
    if (timeoutStartedAt.current === null) {
      timeoutStartedAt.current = now;
    }

    const timeSinceTimeoutStarted = now - timeoutStartedAt.current;
    if (timeSinceTimeoutStarted >= delayMS) {
      setVWC(value, switchesToValue);
      return;
    }

    setVWC(value, originalValue);
    let timeout: NodeJS.Timeout | null = setTimeout(() => {
      timeout = null;
      setVWC(value, switchesToValue);
    }, delayMS - timeSinceTimeoutStarted);
    return () => {
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    };
  }, [value, originalValue, switchesToValue, delayMS]);

  return value;
}
