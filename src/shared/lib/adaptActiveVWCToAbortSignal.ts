import { ValueWithCallbacks } from './Callbacks';
import { adaptCallbacksToAbortSignal } from './adaptCallbacksToAbortSignal';

/**
 * Adapts a boolean value with callbacks that indicates if the request
 * is still active to a window abort signal with the same meaning,
 * where supported. Unlike with using `adaptCallbacksToAbortSignal`
 * directly, this will reject if `activeVWC` was false when this
 * function was called.
 */
export const adaptActiveVWCToAbortSignal = <T>(
  activeVWC: ValueWithCallbacks<boolean>,
  fn: (signal: AbortSignal | undefined) => Promise<T>
): Promise<T> => {
  return adaptCallbacksToAbortSignal(activeVWC.callbacks, (signal) => {
    if (!activeVWC.get()) {
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    }
    return fn(signal);
  });
};
