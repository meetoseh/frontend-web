import { MutableRefObject, useRef } from 'react';
import { ValueWithCallbacks, createWritableValueWithCallbacks } from '../lib/Callbacks';
import { CancelablePromise } from '../lib/CancelablePromise';
import { setVWC } from '../lib/setVWC';
import { delayCancelableUntilResolved } from '../lib/delayCancelableUntilResolved';
import { createCancelableTimeout } from '../lib/createCancelableTimeout';
import { DisplayableError } from '../lib/errors';

export type SaveableState<T> =
  | {
      /**
       * - `ready`: The value matches on the server and client as far as we know
       */
      type: 'ready';
      /**
       * - `ready`: the matching value on the client and server
       */
      value: T;
    }
  | {
      /**
       * - `draft`: The value client has made changes it hasn't persisted yet
       */
      type: 'draft';
      /**
       * The value the server has
       */
      serverValue: T;
      /**
       * - `draft`: the value on the client
       */
      value: T;
      /**
       * A hint indicating that changes will not persist right now, i.e.,
       * calling onClientChange will not effect the state client-side.
       * This can be used for UX purposes (e.g., disabled states).
       */
      disabled: boolean;
    }
  | {
      /**
       * - `error`: we tried to safe a draft and it failed
       */
      type: 'error';
      /**
       * The value we tried to save, which errored
       */
      erroredValue: T;
      /**
       * An element explaining the error
       */
      error: DisplayableError;
      /**
       * - `error`: the value on the server
       */
      serverValue: T;
    };

export type Saveable<T> = {
  /**
   * The current state to render
   */
  state: ValueWithCallbacks<SaveableState<T>>;

  /**
   * Called when the client tries to modify T. This may not actually modify the
   * state and thus the caller MUST NOT invoke the state's callbacks directly
   * (this function will do so if necessary)
   */
  onClientChange: (value: T) => void;

  /**
   * Used to indicate we should switch to a draft state, but that the actual
   * change won't be reflected in the state. Used for performance reasons.
   * There must be some other way for us to get the new value via polling,
   * e.g, `beforeSave` when using `useSaveable`.
   */
  onClientFastChange: () => void;

  /**
   * Called to request that the client's changes be saved. This may not actually
   * do anything. The caller MUST NOT invoke the state's callbacks directly
   * (this function will do so if necessary)
   *
   * This will return a promise which resolves when the state becomes
   * 'ready' and rejects if either it chooses not to save or an error occurs
   * while saving.
   */
  requestImmediateSave: () => Promise<void>;

  /**
   * Cancels any pending saves and disables onClientChange and requestImmediateSave.
   */
  dispose: () => void;
};

/**
 * Creates a fully-functional Saveable object using the given save function
 */
export function createSaveable<T>({
  initial,
  beforeSave,
  save,
  debounce,
}: {
  initial: T;
  /**
   * If onClientChange is called after a debounce period, this updates to the latest
   * client version of T
   */
  beforeSave: (aboutToSave: T) => T;
  save: (value: T, oldValue: T) => CancelablePromise<T>;
  /**
   * If not undefined, we will automatically save after this debounce period.
   * If undefined, only saves when `requestImmediateSave` is called.
   */
  debounce?: number;
}): Saveable<T> {
  const state = createWritableValueWithCallbacks<SaveableState<T>>({
    type: 'ready',
    value: initial,
  });

  let active = true;
  let savePromise: CancelablePromise<T> | null = null;
  let saveCounter = 0;

  const bindSave = (): [T | null, T] => {
    const value = state.get();

    if (value.type === 'ready') {
      return [null, value.value];
    } else if (value.type === 'draft') {
      return [beforeSave(value.value), value.serverValue];
    } else if (value.type === 'error') {
      return [value.erroredValue, value.serverValue];
    } else {
      throw new Error(`unknown: ${value}`);
    }
  };

  const prepareSave = (): (() => CancelablePromise<T>) => {
    const id = ++saveCounter;
    const [valueToSave, serverValue] = bindSave();
    return () => {
      if (!active || saveCounter !== id) {
        return {
          promise: Promise.reject(new Error('canceled')),
          cancel: () => {},
          done: () => true,
        };
      }

      if (valueToSave === null) {
        return {
          promise: Promise.resolve(serverValue),
          cancel: () => {},
          done: () => true,
        };
      }

      const result = save(valueToSave, serverValue);
      result.promise.then(
        (newValue) => {
          if (saveCounter !== id) {
            return;
          }

          setVWC(state, { type: 'ready', value: newValue });
          savePromise = null;
        },
        async (e) => {
          if (saveCounter !== id) {
            return;
          }

          const err =
            e instanceof DisplayableError
              ? e
              : new DisplayableError('client', 'Saveable#save', `${e}`);
          if (saveCounter !== id) {
            return;
          }

          setVWC(state, {
            type: 'error',
            erroredValue: valueToSave,
            error: err,
            serverValue,
          });
          savePromise = null;
        }
      );
      return result;
    };
  };

  return {
    state,
    onClientChange: (value) => {
      if (!active) {
        return;
      }

      if (savePromise !== null) {
        savePromise.cancel();
        savePromise = null;
      }

      const oldState = state.get();
      let serverValue: T;
      if (oldState.type === 'ready') {
        serverValue = oldState.value;
      } else if (oldState.type === 'draft') {
        serverValue = oldState.serverValue;
      } else if (oldState.type === 'error') {
        serverValue = oldState.serverValue;
      } else {
        throw new Error('unknown: ' + oldState);
      }

      setVWC(state, { type: 'draft', value, serverValue, disabled: false });
      if (debounce !== undefined) {
        savePromise = delayCancelableUntilResolved(
          () => prepareSave()(),
          createCancelableTimeout(debounce)
        );
      }
    },
    onClientFastChange: () => {
      if (state.get().type !== 'draft') {
        const oldState = state.get();
        let draftValue: T;
        let serverValue: T;
        if (oldState.type === 'ready') {
          draftValue = oldState.value;
          serverValue = oldState.value;
        } else if (oldState.type === 'draft') {
          draftValue = oldState.value;
          serverValue = oldState.serverValue;
        } else if (oldState.type === 'error') {
          draftValue = oldState.erroredValue;
          serverValue = oldState.serverValue;
        } else {
          throw new Error('unknown: ' + oldState);
        }

        setVWC(state, {
          type: 'draft',
          value: draftValue,
          serverValue,
          disabled: false,
        });
      }
    },
    requestImmediateSave: async () => {
      if (!active) {
        return;
      }

      if (savePromise === null) {
        savePromise = prepareSave()();
      }
      await savePromise.promise;
    },
    dispose: () => {
      active = false;
      saveCounter++;
      if (savePromise !== null) {
        savePromise.cancel();
        savePromise = null;
      }
    },
  };
}

/**
 * Hook-like wrapper around createSaveable. The save function can be updated,
 * but changes to `initial` and `debounce` are ignored.
 */
export function useSaveable<T>({
  initial,
  beforeSave,
  save,
  debounce,
}: {
  initial: T;
  /** For fields that change too quickly for guarranteeing in sync at all times */
  beforeSave: (aboutToSave: T) => T;
  save: (value: T, oldValue: T) => CancelablePromise<T>;
  debounce?: number;
}): Saveable<T> {
  const saveable = useRef<Saveable<T>>() as MutableRefObject<Saveable<T>>;
  const beforeSaveRef = useRef(beforeSave);
  beforeSaveRef.current = beforeSave;

  const saveRef = useRef(save);
  saveRef.current = save;

  if (saveable.current === undefined) {
    saveable.current = createSaveable({
      initial,
      beforeSave: (value) => beforeSaveRef.current(value),
      save: (value, oldValue) => saveRef.current(value, oldValue),
      debounce,
    });
  }
  return saveable.current;
}
