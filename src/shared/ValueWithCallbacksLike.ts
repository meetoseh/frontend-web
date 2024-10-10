import { MutableRefObject, useEffect, useRef } from 'react';
import { createValueWithCallbacksEffect } from './hooks/createValueWithCallbacksEffect';
import { Callbacks, createWritableValueWithCallbacks, ValueWithCallbacks } from './lib/Callbacks';
import { setVWC } from './lib/setVWC';
import { defaultEqualityFn } from './hooks/useMappedValueWithCallbacks';

export type ValueWithCallbacksLikeReactManaged<T> = {
  value: T;
  get?: undefined;
  callbacks?: undefined;
};

/**
 * A direct alternative to VariableStrategyProps that is a superset of value with callbacks,
 * making that flow really easy, and using just { value: T } for react-managed values
 */
export type ValueWithCallbacksLike<T> =
  | ValueWithCallbacksLikeReactManaged<T>
  | ValueWithCallbacks<T>;

/**
 * Unwraps the given value with callbacks like prop to an actual
 * value with callbacks and dispose function
 */
export const createValueWithCallbacksLikeVWC = <T>(
  value: ValueWithCallbacksLike<T>,
  opts?: {
    equalityFn?: (a: T, b: T) => boolean;
  }
): [ValueWithCallbacks<T>, () => void] => {
  const result = createWritableValueWithCallbacks<T>(
    value.get !== undefined ? value.get() : value.value
  );
  const cleanupAttacher =
    value.get !== undefined
      ? createValueWithCallbacksEffect(value, (inner) => {
          setVWC(result, inner, opts?.equalityFn);
          return undefined;
        })
      : () => {};

  return [result, cleanupAttacher];
};

/**
 * Upgrades a value with callbacks like object to an actual value with callbacks
 * in a hook-like manner
 */
export const useValueWithCallbacksLikeVWC = <T>(
  value: ValueWithCallbacksLike<T>,
  opts?: {
    equalityFn?: (a: T, b: T) => boolean;
  }
): ValueWithCallbacks<T> => {
  const resultRef = useRef() as MutableRefObject<ValueWithCallbacks<T>>;
  const equalityFnRef = useRef(opts?.equalityFn ?? defaultEqualityFn);
  equalityFnRef.current = opts?.equalityFn ?? defaultEqualityFn;

  useEffect(() => {
    const [result, cleanup] = createValueWithCallbacksLikeVWC(value, {
      equalityFn: (a, b) => equalityFnRef.current(a, b),
    });
    resultRef.current = result;
    return cleanup;
  }, [value, opts]);

  if (resultRef.current === undefined) {
    const val = value.get !== undefined ? value.get() : value.value;
    return { get: () => val, callbacks: new Callbacks() };
  }

  return resultRef.current;
};
