import { ValueWithCallbacks } from '../lib/Callbacks';

/**
 * Uses all the callbacks on the given list of value with callbacks to trigger an
 * effect-like function, i.e., a function which returns a callback to
 * cleanup side effects.
 *
 * Besides being usable outside of a hook, this is actually composable.
 *
 * @param vwcs The values with callbacks to watch.
 * @param effect The effect function which handles the value
 * @param opts.applyImmediately if true, we do not use setTimeout to delay
 *   the start of the next trigger. Generally its desirable to delay the effect
 *   when hooking into multiple vwcs to allow time for all of them to update.
 */
export function createValuesWithCallbacksEffect<T, U extends ValueWithCallbacks<T>>(
  vwcs: U[],
  effect: () => (() => void) | undefined,
  opts?: {
    applyImmediately?: boolean;
  }
): () => void {
  const applyImmediately = opts?.applyImmediately ?? false;

  let attached = true;
  let timeout: NodeJS.Timeout | null = null;
  let cancel = () => {};
  for (const vwc of vwcs) {
    vwc.callbacks.add(trigger);
  }
  triggerImmediately();
  return () => {
    attached = false;
    for (const vwc of vwcs) {
      vwc.callbacks.remove(trigger);
    }
    cancel();
    cancel = () => {};
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  function triggerImmediately() {
    cancel();

    if (!attached) {
      cancel = () => {};
      return;
    }

    const newCancel = effect();
    if (newCancel !== undefined) {
      if (!attached) {
        newCancel();
        return;
      }

      cancel = newCancel;
    }
  }

  function trigger() {
    if (!attached) {
      return;
    }

    if (applyImmediately) {
      triggerImmediately();
      return;
    }

    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }

    cancel();
    cancel = () => {};
    timeout = setTimeout(() => {
      timeout = null;
      triggerImmediately();
    }, 0);
  }
}
