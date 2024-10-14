import { useEffect } from 'react';
import { createValueWithCallbacksEffect } from './hooks/createValueWithCallbacksEffect';
import {
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
  ValueWithCallbacks,
} from './lib/Callbacks';
import { setVWC } from './lib/setVWC';

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
  const result = useWritableValueWithCallbacks<T>(() =>
    value.get === undefined ? value.value : value.get()
  );
  useEffect(() => {
    if (value.get === undefined) {
      setVWC(result, value.value, opts?.equalityFn);
      return undefined;
    }

    return createValueWithCallbacksEffect(value, (inner) => {
      setVWC(result, inner, opts?.equalityFn);
      return undefined;
    });
  });
  return result;
};
