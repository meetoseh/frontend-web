import { ValueWithCallbacks, createWritableValueWithCallbacks } from '../lib/Callbacks';
import { setVWC } from '../lib/setVWC';
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
  const result = createWritableValueWithCallbacks<U>(
    (() => {
      const valRaw = wrapped.get();
      if (valRaw === null) {
        return other(valRaw);
      }
      const val = valRaw.data.get();
      if (val.type === 'success') {
        return success(val);
      }
      return other(val);
    })()
  );

  let active = true;
  let cancel = () => {};
  wrapped.callbacks.add(onWrappedChanged);
  onWrappedChanged();
  return [
    result,
    () => {
      active = false;
      wrapped.callbacks.remove(onWrappedChanged);
      cancel();
      cancel = () => {};
    },
  ];

  function onWrappedChanged() {
    cancel();
    if (!active) {
      cancel = () => {};
      return;
    }

    const valRaw = wrapped.get();
    if (valRaw === null) {
      setVWC(result, other(valRaw));
      return;
    }

    const data = valRaw.data;
    data.callbacks.add(onDataChanged);
    cancel = () => {
      data.callbacks.remove(onDataChanged);
      cancel = () => {};
    };

    function onDataChanged() {
      if (!active) {
        return;
      }

      const val = data.get();
      if (val.type === 'success') {
        setVWC(result, success(val));
      } else {
        setVWC(result, other(val));
      }
    }
  }
};
