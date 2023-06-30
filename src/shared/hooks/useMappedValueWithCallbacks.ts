import { useEffect } from 'react';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';

/**
 * Creates a new value with callbacks which maps the original value using the
 * given mapper function.
 *
 * @param original The original value with callbacks
 * @param mapper The mapper function
 * @returns The mapped value with callbacks
 */
export const useMappedValueWithCallbacks = <T, U>(
  original: ValueWithCallbacks<T>,
  mapper: (value: T) => U
): ValueWithCallbacks<U> => {
  const result = useWritableValueWithCallbacks<U>(() => mapper(original.get()));

  useEffect(() => {
    original.callbacks.add(handleChange);
    handleChange();
    return () => {
      original.callbacks.remove(handleChange);
    };

    function handleChange() {
      const newValue = mapper(original.get());
      if (newValue !== result.get()) {
        result.set(newValue);
        result.callbacks.call(undefined);
      }
    }
  }, [original, result, mapper]);

  return result;
};
