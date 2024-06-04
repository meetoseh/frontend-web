import { createValueWithCallbacksEffect } from '../hooks/createValueWithCallbacksEffect';
import { ValueWithCallbacks, createWritableValueWithCallbacks } from './Callbacks';

/**
 * Given a value with callbacks for another value with callbacks, flattens
 * the structure to a new value with callbacks which updates with the current
 * inner-most value.
 *
 * Generally you don't get VWCs nested like this directly, but it does often
 * come up a bit more subtly, e.g, a vwc for an object which itself contains
 * a VWC.
 *
 * Unwrapping can be a pretty subtle / confusing operation, so it's generally
 * better to use mapping functions to get to this format and then use this function
 * to flatten it. This is particularly true if the nested VWC can normally be null,
 * as writing the proper unwrapping logic in that scenario has proven to be very
 * unsuccessful (until mapping and using this became the dominant strategy)
 */
export const unwrapNestedVWC = <T>(
  wrapped: ValueWithCallbacks<ValueWithCallbacks<T>>
): [ValueWithCallbacks<T>, () => void] => {
  const result = createWritableValueWithCallbacks(wrapped.get().get());

  const cleanup = createValueWithCallbacksEffect(wrapped, (inner) => {
    return createValueWithCallbacksEffect(inner, (value) => {
      result.set(value);
      result.callbacks.call(undefined);
      return undefined;
    });
  });

  return [result, cleanup];
};
