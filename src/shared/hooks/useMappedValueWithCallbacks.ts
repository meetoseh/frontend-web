import { useEffect, useRef } from 'react';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';

export type MappedValueWithCallbacksOpts<T, U> = {
  /**
   * The function which can be used to determine if the two inputs are identical
   * for the purposes of the mapping function. If they are identical, the mapper
   * isn't called. For this to be helpful, this has to be faster than just calling
   * the mapper function and comparing the outputs.
   *
   * @param a The first input
   * @param b The second input
   * @returns True if the two inputs are functionally identical, false otherwise
   * @default Object.is
   */
  inputEqualityFn?: (a: T, b: T) => boolean;

  /**
   * The function which can be used to determine if the two outputs are
   * identical. This will skip callbacks on the output value, which can be a
   * performance improvement.
   *
   * @param a The first output
   * @param b The second output
   * @returns True if they are the same, false otherwise
   * @default Object.is
   */
  outputEqualityFn?: (a: U, b: U) => boolean;
};

/**
 * Creates a new value with callbacks which maps the original value using the
 * given mapper function.
 *
 * @param original The original value with callbacks
 * @param mapper The mapper function
 * @param rawOpts Additional options while mapping
 * @returns The mapped value with callbacks
 */
export const useMappedValueWithCallbacks = <T, U>(
  original: ValueWithCallbacks<T>,
  mapper: (value: T) => U,
  rawOpts?: MappedValueWithCallbacksOpts<T, U>
): ValueWithCallbacks<U> => {
  const opts: Required<MappedValueWithCallbacksOpts<T, U>> = Object.assign(
    {
      inputEqualityFn: Object.is,
      outputEqualityFn: Object.is,
    },
    rawOpts
  );
  const lastInputRef = useRef(original.get());
  const result = useWritableValueWithCallbacks<U>(() => {
    const newInput = original.get();
    lastInputRef.current = newInput;
    return mapper(newInput);
  });

  useEffect(() => {
    original.callbacks.add(handleChange);
    handleChange();
    return () => {
      original.callbacks.remove(handleChange);
    };

    function handleChange() {
      const newInput = original.get();
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
  }, [original, result, mapper, opts.inputEqualityFn, opts.outputEqualityFn]);

  return result;
};
