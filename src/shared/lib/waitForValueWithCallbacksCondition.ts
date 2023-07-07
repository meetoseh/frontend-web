import { ValueWithCallbacks } from './Callbacks';
import { CancelablePromise } from './CancelablePromise';

/**
 * Returns a promise which resolves when the given value with callbacks
 * meets the given condition. There is a cancelable variant
 * waitForValueWithCallbacksConditionCancelable.
 *
 * @param vwc The value with callbacks to wait for.
 * @param condition The condition to wait for.
 * @returns A promise which resolves when the given value with callbacks
 *   meets the given condition. Resolves with the value at the time the
 *   condition was met.
 */
export const waitForValuesWithCallbacksCondition = <T>(
  vwc: ValueWithCallbacks<T>,
  condition: (v: T) => boolean
): Promise<T> => {
  return new Promise((resolve) => {
    const checkCondition = () => {
      const val = vwc.get();
      if (condition(val)) {
        vwc.callbacks.remove(checkCondition);
        resolve(val);
      }
    };
    vwc.callbacks.add(checkCondition);
    checkCondition();
  });
};

/**
 * Returns a cancelable promise which resolves when the given value with
 * callbacks meets the given condition. There is a non-cancelable variant
 * waitForValueWithCallbacksCondition.
 *
 * @param vwc The value with callbacks to wait for.
 * @param condition The condition to wait for.
 * @returns A cancelable promise which resolves when the given value with
 *   callbacks meets the given condition. Resolves with the value at the
 *   time the condition was met. Rejects with the string 'canceled' if
 *   canceled.
 */
export const waitForValueWithCallbacksConditionCancelable = <T>(
  vwc: ValueWithCallbacks<T>,
  condition: (v: T) => boolean
): CancelablePromise<T> => {
  let active = true;
  let realCanceler = () => {
    active = false;
  };

  const promise = new Promise<T>((resolve, reject) => {
    if (!active) {
      active = false;
      realCanceler = () => {};
      reject('canceled');
      return;
    }

    const checkCondition = () => {
      const val = vwc.get();
      if (condition(val)) {
        active = false;
        vwc.callbacks.remove(checkCondition);
        realCanceler = () => {};
        resolve(val);
      }
    };

    realCanceler = () => {
      active = false;
      vwc.callbacks.remove(checkCondition);
      realCanceler = () => {};
      reject('canceled');
    };
    vwc.callbacks.add(checkCondition);
    checkCondition();
  });

  return {
    done: () => !active,
    cancel: () => realCanceler(),
    promise,
  };
};
