import { createValueWithCallbacksEffect } from '../hooks/createValueWithCallbacksEffect';
import { createMappedValueWithCallbacks } from '../hooks/useMappedValueWithCallbacks';
import { ValueWithCallbacks, createWritableValueWithCallbacks } from '../lib/Callbacks';
import { setVWC } from '../lib/setVWC';
import { unwrapNestedVWC } from '../lib/unwrapNestedVWC';
import { RequestResult, RequestResultConcrete } from './RequestHandler';

/**
 * Unwraps the result of request() on a request handler to a mapped value.
 * Usually, U is just T | null, and this is used as follows:
 *
 * ```ts
 * unwrapRequestResult(
 *   wrapped,
 *   (d) => d.data,
 *   () => null
 * )
 * ```
 *
 * which throws away error/loading states and replaces them with null, for
 * simplicity downstream.
 *
 * The reason you end up with a VWC of a request result in the first place is
 * in the resource handler of a screen, for tracking which request you are currently
 * using to load data.
 */
export const unwrapRequestResult = <T extends object, U>(
  wrapped: ValueWithCallbacks<RequestResult<T> | null>,
  success: (data: RequestResultConcrete<T> & { type: 'success' }) => U,
  other: (data: RequestResultConcrete<T> | null) => U
): [ValueWithCallbacks<U>, () => void] => {
  // switch to VWC<VWC<U> | null>, then use the standard unwrapper
  const standardWrappedVWC = createWritableValueWithCallbacks<ValueWithCallbacks<U>>(
    createWritableValueWithCallbacks(other(null))
  );
  const cleanup = createValueWithCallbacksEffect(wrapped, (concrete) => {
    if (concrete === null) {
      const vwc = createWritableValueWithCallbacks(other(null));
      setVWC(standardWrappedVWC, vwc);
      return undefined;
    }

    const [mapped, cleanup] = createMappedValueWithCallbacks(concrete.data, (d) => {
      if (d.type === 'success') {
        return success(d);
      }
      return other(d);
    });
    setVWC(standardWrappedVWC, mapped);
    return cleanup;
  });
  const [unwrapped, cleanupUnwrapper] = unwrapNestedVWC(standardWrappedVWC);
  return [
    unwrapped,
    () => {
      cleanupUnwrapper();
      cleanup();
    },
  ];
};
