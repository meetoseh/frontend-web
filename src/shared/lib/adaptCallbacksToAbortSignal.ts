import { Callbacks } from './Callbacks';

/**
 * Uses the given callbacks to create an abort signal, which is
 * aborted when the callbacks are executed. The signal is
 * detached from the callbacks when the promise resolves.
 *
 * @param callbacks The callbacks to use to create the abort signal
 * @param fn The function to call with the abort signal
 */
export const adaptCallbacksToAbortSignal = async <T, C>(
  callbacks: Callbacks<C>,
  fn: (signal: AbortSignal | undefined) => Promise<T>
): Promise<T> => {
  const controller = window.AbortController ? new AbortController() : undefined;
  const signal = controller?.signal;
  const doAbort = () => controller?.abort();
  callbacks.add(doAbort);
  try {
    return await fn(signal);
  } finally {
    callbacks.remove(doAbort);
  }
};
