import { createWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { setVWC } from '../../../shared/lib/setVWC';
import { waitForValueWithCallbacksConditionCancelable } from '../../../shared/lib/waitForValueWithCallbacksCondition';

/**
 * A simple async storage interface to a specific key that can only be
 * accessed while a lock is held preventing the value from being mutated
 */
export type SimpleAsyncStorage = {
  /**
   * Acquires the lock and calls the handler with the current value,
   * waits for the result. If it is a string, the storage is updated
   * with the new value. If it is null, the storage is cleared. If
   * it is undefined, the storage is left unchanged (generally used
   * for handling aborts).
   *
   * On the web, if WebLocks are supported, then this will guard against
   * other tabs accessing the key as well. Otehrwise, this is an instance
   * specific lock.
   *
   * The promise resolves or rejects when the request completely finishes or is
   * completely aborted.
   */
  withStore: (
    this: void,
    handler: (
      stored: string | null,
      opts: { signal: AbortSignal }
    ) => Promise<string | null | undefined>,
    opts: { signal: AbortSignal }
  ) => Promise<void>;
};

const usingWeblocks =
  window &&
  window.navigator &&
  window.navigator.locks &&
  typeof window.navigator.locks.request === 'function';

/**
 * Creates a simple async storage adapter that stores the value in
 * localStorage at the given key. If WebLocks are supported, uses the
 * lockId as the lock name.
 */
export const createUnencryptedStorageAdapter = (
  key: string,
  lockId: string
): SimpleAsyncStorage => {
  const instanceLock = createWritableValueWithCallbacks<boolean>(false);

  const storage = (() => {
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      return localStorage;
    } catch {
      return sessionStorage;
    }
  })();

  return {
    withStore: async (handler, opts) => {
      const canceled = createWritableValueWithCallbacks(false);
      const doAbort = () => setVWC(canceled, true);
      opts.signal.addEventListener('abort', doAbort);
      if (opts.signal.aborted) {
        doAbort();
      }

      try {
        const canceledCancelable = waitForValueWithCallbacksConditionCancelable(canceled, (c) => c);
        canceledCancelable.promise.catch(() => {});
        while (true) {
          const instanceUnlocked = waitForValueWithCallbacksConditionCancelable(
            instanceLock,
            (l) => !l
          );
          instanceUnlocked.promise.catch(() => {});

          await Promise.race([canceledCancelable.promise, instanceUnlocked.promise]);
          instanceUnlocked.cancel();

          if (canceled.get()) {
            return;
          }

          if (instanceLock.get()) {
            continue;
          }

          instanceLock.set(true);
          instanceLock.callbacks.call(undefined);
          break;
        }

        try {
          let releaseWebLock = () => {};

          if (usingWeblocks) {
            let lockInstantlyReleased = false;
            let releaseLock = () => {
              lockInstantlyReleased = true;
            };
            const lockPromise = new Promise<void>((resolve) => {
              if (lockInstantlyReleased) {
                resolve();
                return;
              }
              releaseLock = resolve;
            });

            let lockInstantlyAcquired = false;
            let onAcquiredLock = () => {
              lockInstantlyAcquired = true;
            };
            const acquiredPromise = new Promise<void>((resolve) => {
              if (lockInstantlyAcquired) {
                resolve();
                return;
              }
              onAcquiredLock = resolve;
            });
            window.navigator.locks.request(
              lockId,
              {
                signal: opts.signal,
              },
              async () => {
                onAcquiredLock();
                await lockPromise;
              }
            );

            releaseWebLock = () => releaseLock();
            await Promise.race([canceledCancelable.promise, acquiredPromise]);
            if (canceled.get()) {
              releaseWebLock();
              return;
            }
          }

          try {
            // cancellation is now the responsibility of the handler
            canceledCancelable.cancel();
            const stored = storage.getItem(key);
            const result = await handler(stored, opts);
            if (result !== undefined) {
              if (result === null) {
                storage.removeItem(key);
              } else {
                storage.setItem(key, result);
              }
            }
          } finally {
            releaseWebLock();
          }
        } finally {
          instanceLock.set(false);
          instanceLock.callbacks.call(undefined);
        }
      } finally {
        opts.signal.removeEventListener('abort', doAbort);
        doAbort();
      }
    },
  };
};
