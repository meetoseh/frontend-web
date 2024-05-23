import { ValueWithCallbacks } from '../lib/Callbacks';

/**
 * Uses the callbacks on the given value with callbacks to trigger an
 * effect-like function, i.e., a function which returns a callback to
 * cleanup side effects.
 *
 * Besides being usable outside of a hook, this is actually composable.
 *
 * @param vwc The value with callbacks to watch.
 * @param effect The effect function which handles the value
 * @param opts.applyBeforeCancel If true, when we are mounted and going to
 *   cancel followed by an immediate effect() call, we will call effect() before
 *   the previous cancel finishes. This can be useful when the effect is intended
 *   to protect resources from cleanup, releasing them in the canceler, to avoid
 *   a moment where the resources are unduly released.
 */
export function createValueWithCallbacksEffect<T>(
  vwc: ValueWithCallbacks<T>,
  effect: (value: T) => (() => void) | undefined,
  opts?: {
    applyBeforeCancel?: boolean;
  }
): () => void {
  const applyBeforeCancel = opts?.applyBeforeCancel ?? false;
  let attached = true;
  let cancel = () => {};
  vwc.callbacks.add(trigger);
  trigger();
  return () => {
    attached = false;
    vwc.callbacks.remove(trigger);
    cancel();
    cancel = () => {};
  };

  function triggerNormal() {
    cancel();

    if (!attached) {
      cancel = () => {};
      return;
    }

    const newCancel = effect(vwc.get());
    if (newCancel !== undefined) {
      if (!attached) {
        newCancel();
        return;
      }

      cancel = newCancel;
    }
  }

  function triggerInverted() {
    const canceler = cancel;
    cancel = () => {};

    if (!attached) {
      canceler();
      return;
    }

    const newCancel = effect(vwc.get());
    canceler();
    if (newCancel !== undefined) {
      if (!attached) {
        newCancel();
        return;
      }

      cancel = newCancel;
    }
  }

  function trigger() {
    if (applyBeforeCancel) {
      triggerInverted();
    } else {
      triggerNormal();
    }
  }
}
