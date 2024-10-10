import { MutableRefObject, useEffect, useRef } from 'react';
import {
  ValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../lib/Callbacks';
import { MappedValueWithCallbacksOpts, defaultEqualityFn } from './useMappedValueWithCallbacks';
import { setVWC } from '../lib/setVWC';

/**
 * Similar to useMappedValueWithCallbacks, except this one maps an array of
 * values to a single value, rather than a single value to a single value.
 *
 * This never triggers react rerenders.
 *
 * TypeScript can have trouble determining the type of V in some situations;
 * when this happens, it's generally simplest to not use the argument to
 * mapper and instead reference the array directly, since get() is presumably
 * "free".
 *
 * @param arr The array of values, where each element is specified as an independent
 *   ValueWithCallbacks.
 * @param mapper The function which creates the mapped value given the unwrapped
 *   array of values.
 * @param rawOpts Additional options while mapping
 * @returns The mapped value, wrapped in a ValueWithCallbacks.
 */
export const useMappedValuesWithCallbacks = <V, T extends ValueWithCallbacks<V>[], U>(
  arr: T,
  mapper: (arr: V[]) => U,
  rawOpts?: MappedValueWithCallbacksOpts<V[], U>
): ValueWithCallbacks<U> => {
  const opts: Required<MappedValueWithCallbacksOpts<V[], U>> = Object.assign(
    {
      inputEqualityFn: defaultEqualityFn,
      outputEqualityFn: defaultEqualityFn,
    },
    rawOpts
  );
  const lastInputRef = useRef<V[]>() as MutableRefObject<V[]>;
  if (lastInputRef.current === undefined) {
    lastInputRef.current = arr.map((a) => a.get());
  }
  const result = useWritableValueWithCallbacks<U>(() => mapper(lastInputRef.current));

  useEffect(() => {
    for (const v of arr) {
      v.callbacks.add(handleChange);
    }
    handleChange();
    return () => {
      for (const v of arr) {
        v.callbacks.remove(handleChange);
      }
    };

    function handleChange() {
      const newInput = arr.map((a) => a.get());
      if (opts.inputEqualityFn.call(undefined, lastInputRef.current, newInput)) {
        return;
      }

      const newOutput = mapper(newInput);
      if (opts.outputEqualityFn.call(undefined, result.get(), newOutput)) {
        return;
      }

      lastInputRef.current = newInput;
      result.set(newOutput);
      result.callbacks.call(undefined);
    }
  }, [arr, mapper, result, opts.inputEqualityFn, opts.outputEqualityFn]);

  return result;
};

/**
 * Functional version of useMappedValuesWithCallbacks, but with some quality
 * of life improvements as it was made later:
 *
 * - The mapper function does not get the input array as an argument, as that's
 *   not particularly useful in most cases.
 * - The input equality fn is not accepted and no attempt is made to handle
 *   bad input VWC callback invocations, as it's almost never helpful
 * - The resulting VWCs callbacks are invoked at the start of the next event
 *   loop instead of immediately as very often all the input VWCs are updated
 *   at once.
 */
export const createMappedValuesWithCallbacks = <V, T extends ValueWithCallbacks<V>[], U>(
  arr: T,
  mapper: () => U,
  rawOpts?: Omit<MappedValueWithCallbacksOpts<V[], U>, 'inputEqualityFn'>
): [ValueWithCallbacks<U>, () => void] => {
  const opts: Required<Omit<MappedValueWithCallbacksOpts<V[], U>, 'inputEqualityFn'>> =
    Object.assign(
      {
        outputEqualityFn: defaultEqualityFn,
      },
      rawOpts
    );

  let timeout: NodeJS.Timeout | null = null;

  const result = createWritableValueWithCallbacks<U>(mapper());
  for (const v of arr) {
    v.callbacks.add(handleChange);
  }

  return [
    result,
    () => {
      for (const v of arr) {
        v.callbacks.remove(handleChange);
      }
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    },
  ];

  function handleChangeImmediate() {
    timeout = null;
    setVWC(result, mapper(), opts.outputEqualityFn);
  }

  function handleChange() {
    if (timeout !== null) {
      return;
    }
    timeout = setTimeout(handleChangeImmediate, 0);
  }
};
