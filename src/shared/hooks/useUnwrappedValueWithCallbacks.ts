import { MutableRefObject, useEffect, useRef, useState } from 'react';
import { ValueWithCallbacks } from '../lib/Callbacks';
import { defaultEqualityFn } from './useMappedValueWithCallbacks';

const notSet = Symbol();

/**
 * Unwraps the given ValueWithCallbacks and returns the value; when the
 * value changes, a react rerender is used to update the component. This
 * triggers the react rerender on the next frame; for the web I don't think
 * this is necessary, but for react native it prevents certain very difficult
 * to unravel callback loops.
 *
 * Note that it is not a no-op to use ValueWithCallbacks and then unwrap
 * it later: this will skip the rerender on the parent component. If the
 * only component that changed is very nested, i.e., the state is highly
 * lifted, this is a tremendous performance win with almost no mental
 * overhead.
 *
 * @param original The value to unwrap
 * @param equalityFn The equality function to use to determine if the value has changed.
 *   By default this is the defaultEqualityFn for useMappedValueWithCallbacks, which is
 *   like === but always false for objects.
 * @param applyInstantly If true we apply this change via setState immediately, rather than on
 *  the next frame. This is NOT how react native works, and should only be
 *  used if necessary as it will increase debugging complexity.
 * @returns The unwrapped value
 */
export const useUnwrappedValueWithCallbacks = <T>(
  original: ValueWithCallbacks<T>,
  equalityFn?: (a: T, b: T) => boolean,
  applyInstantly?: boolean
): T => {
  const equalityFnRef = useRef(equalityFn ?? defaultEqualityFn);
  equalityFnRef.current = equalityFn ?? defaultEqualityFn;

  const [value, setValue] = useState<T>(() => original.get());
  const setRerenderCounter = useState(0)[1];

  let currentValue = useRef<T>(notSet as any) as MutableRefObject<T>;
  if (currentValue.current === notSet) {
    currentValue.current = value;
  }

  useEffect(() => {
    let settingValueTo: typeof notSet | T = notSet;
    original.callbacks.add(handleChange);
    handleChange();
    return () => {
      settingValueTo = notSet;
      original.callbacks.remove(handleChange);
    };

    function handleChange() {
      const newValue = original.get();
      if (settingValueTo !== notSet) {
        settingValueTo = newValue;
        return;
      }

      if (!equalityFnRef.current(newValue, currentValue.current)) {
        if (applyInstantly) {
          setValue(() => newValue);
          setRerenderCounter((c) => c + 1);
          currentValue.current = newValue;
        } else {
          settingValueTo = newValue;
          requestAnimationFrame(() => {
            const setTo = settingValueTo;
            settingValueTo = notSet;
            if (setTo !== notSet && !equalityFnRef.current(setTo, currentValue.current)) {
              currentValue.current = setTo;
              setValue(() => setTo);
              setRerenderCounter((c) => c + 1);
            }
          });
        }
      }
    }
  }, [original, applyInstantly, setRerenderCounter]);

  return value;
};
