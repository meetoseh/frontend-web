import { useEffect, useRef, useState } from 'react';

/**
 * A basic hook which provides the first value for the given duration, then
 * switches to the second value.
 *
 * @param originalValue The initial value to use.
 * @param switchesToValue The value to switch to after the given delay.
 * @param delayMS The delay in milliseconds before switching to the second value.
 */
export function useTimedValue<T>(originalValue: T, switchesToValue: T, delayMS: number) {
  const [value, setValue] = useState<T>(originalValue);
  const timeoutStartedAt = useRef<number | null>(null);

  useEffect(() => {
    const now = Date.now();
    if (timeoutStartedAt.current === null) {
      timeoutStartedAt.current = now;
    }

    const timeSinceTimeoutStarted = now - timeoutStartedAt.current;
    if (timeSinceTimeoutStarted >= delayMS) {
      setValue(switchesToValue);
      return;
    }

    setValue(originalValue);
    let timeout: NodeJS.Timeout | null = setTimeout(() => {
      timeout = null;
      setValue(switchesToValue);
    }, delayMS - timeSinceTimeoutStarted);
    return () => {
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    };
  }, [originalValue, switchesToValue, delayMS]);

  return value;
}
