import { Dispatch, SetStateAction } from 'react';
import { WritableValueWithCallbacks } from './Callbacks';
import { defaultEqualityFn } from '../hooks/useMappedValueWithCallbacks';
import { setVWC } from './setVWC';

/**
 * Creates a set state like function which sets the value of the
 * given VWC
 */
export const adaptValueWithCallbacksAsSetState = <T extends object | number | string | boolean>(
  vwc: WritableValueWithCallbacks<T>,
  options?: {
    equalityFn?: (a: T, b: T) => boolean;
  }
): Dispatch<SetStateAction<T>> => {
  const equalityFn = options?.equalityFn ?? defaultEqualityFn;

  return (valueOrUpdater: T | ((prev: T) => T)) => {
    if (typeof valueOrUpdater === 'function') {
      const value = valueOrUpdater(vwc.get());
      setVWC(vwc, value, equalityFn);
    } else {
      setVWC(vwc, valueOrUpdater, equalityFn);
    }
  };
};
