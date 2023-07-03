import { useEffect, useState } from 'react';
import { ValueWithCallbacks } from '../lib/Callbacks';

/**
 * Unwraps the given ValueWithCallbacks and returns the value; when the
 * value changes, a react rerender is used to update the component.
 *
 * Note that it is not a no-op to use ValueWithCallbacks and then unwrap
 * it later: this will skip the rerender on the parent component. If the
 * only component that changed is very nested, i.e., the state is highly
 * lifted, this is a tremendous performance win with almost no mental
 * overhead.
 *
 * @param original The value to unwrap
 * @returns The unwrapped value
 */
export const useUnwrappedValueWithCallbacks = <T>(original: ValueWithCallbacks<T>): T => {
  const [value, setValue] = useState<T>(original.get());

  useEffect(() => {
    original.callbacks.add(handleChange);
    handleChange();
    return () => {
      original.callbacks.remove(handleChange);
    };

    function handleChange() {
      const newValue = original.get();
      setValue(newValue);
    }
  }, [original]);

  return value;
};
