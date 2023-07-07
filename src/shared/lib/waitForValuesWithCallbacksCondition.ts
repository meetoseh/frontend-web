import { ValueWithCallbacks } from './Callbacks';
import { CancelablePromise } from './CancelablePromise';

/**
 * Returns a promise which resolves when the given values with callbacks
 * meets the given condition. There is a cancelable variant
 * waitForValueWithCallbacksConditionCancelable.
 *
 * Because providing a useful type hint for the vwcs is difficult, for
 * consistency the callee must get() the values directly from the
 * vwcs (where types will be preserved), rather than having them passed
 * to the condition or resolved in the promise.
 *
 * @param vwc The value with callbacks to wait for.
 * @param condition The condition to wait for.
 * @returns A promise which resolves when the condition is met, where the
 *   condition is only checked when one of the vwcs changes.
 */
export const waitForValuesWithCallbacksCondition = <U, T extends ValueWithCallbacks<U>>(
  vwcs: T[],
  condition: () => boolean
): Promise<void> => {
  return new Promise((resolve) => {
    const checkCondition = () => {
      if (condition()) {
        for (const vwc of vwcs) {
          vwc.callbacks.remove(checkCondition);
        }
        resolve();
      }
    };
    for (const vwc of vwcs) {
      vwc.callbacks.add(checkCondition);
    }
    checkCondition();
  });
};

/**
 * Returns a promise which resolves when the given values with callbacks
 * meets the given condition. There is a non-cancelable variant
 * waitForValuesWithCallbacksCondition.
 *
 * Because providing a useful type hint for the vwcs is difficult, for
 * consistency the callee must get() the values directly from the
 * vwcs (where types will be preserved), rather than having them passed
 * to the condition or resolved in the promise.
 *
 * @param vwc The value with callbacks to wait for.
 * @param condition The condition to wait for.
 * @returns A cancelable promise which resolves when the condition is met,
 *   where the condition is only checked when one of the vwcs changes.
 */
export const waitForValuesWithCallbacksConditionCancelable = <U, T extends ValueWithCallbacks<U>>(
  vwcs: T[],
  condition: () => boolean
): CancelablePromise<void> => {
  let active = true;
  let realCanceler = () => {
    active = false;
  };

  const promise = new Promise<void>((resolve, reject) => {
    if (!active) {
      active = false;
      realCanceler = () => {};
      reject('canceled');
      return;
    }

    const checkCondition = () => {
      if (condition()) {
        active = false;
        for (const vwc of vwcs) {
          vwc.callbacks.remove(checkCondition);
        }
        realCanceler = () => {};
        resolve();
      }
    };

    realCanceler = () => {
      active = false;
      for (const vwc of vwcs) {
        vwc.callbacks.remove(checkCondition);
      }
      realCanceler = () => {};
      reject('canceled');
    };
    for (const vwc of vwcs) {
      vwc.callbacks.add(checkCondition);
    }
    checkCondition();
  });

  return {
    done: () => !active,
    cancel: () => realCanceler(),
    promise,
  };
};
