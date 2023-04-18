import { DependencyList, useEffect, useMemo, useRef } from 'react';
import { Callbacks } from './Callbacks';
import { createCancelablePromiseFromCallbacks } from './createCancelablePromiseFromCallbacks';

/**
 * Acts like useEffect, except the effect is passed an onDone handler which
 * should be called when the effect is done working. Future calls are
 * deduplicated and delayed to ensure the effect is only being run once at a
 * time.
 *
 * NOTE:
 *   For now, destructors are always run immediately after the effect finishes.
 *   This is done just because the effects that want to be singleton generally
 *   aren't manipulating the dom, and hence this is a good enough way to handle
 *   destruction. However, those using this should not rely on that behavior as
 *   it could at some point be changed to be more like useEffect, where it doesn't
 *   get called unless the dependencies change or the component is being unmounted.
 *
 *   What this will guarrantee is that the destructor is always called before the
 *   next effect is run. This will not guarrantee that the destructor is not called
 *   before onDone is called.
 *
 *
 * @param effect The effect-like handler, which is passed an onDone handler
 * @param deps The dependencies for the effect
 */
export const useSingletonEffect = (
  effect: (onDone: () => void) => void | (() => void),
  deps: DependencyList | undefined
) => {
  const effectMemod = useMemo(
    () => effect,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  );
  const runningLock = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let active = true;
    const activeChangedCallback = new Callbacks<undefined>();
    acquireLockAndRunEffect();
    return () => {
      active = false;
      activeChangedCallback.call(undefined);
    };

    /**
     * Runs the effect, returning a promise for when it's done.
     */
    function runEffect(): Promise<void> {
      let resolvedInstantly: boolean = false;
      let innerResolve: () => void = () => {
        resolvedInstantly = true;
      };
      const destructor = effectMemod(() => {
        innerResolve();
      });
      const destructorFn = typeof destructor === 'function' ? destructor : () => {};

      return new Promise((resolve) => {
        if (resolvedInstantly) {
          destructorFn();
          resolve();
          return;
        }

        innerResolve = () => {
          destructorFn();
          resolve();
        };
      });
    }

    /**
     * Acquires the lock, runs the effect, and releases the lock.
     * If the lock is already acquired, this will wait until the lock is
     * available; if the effect is unmounted before the lock is ready,
     * this will do nothing.
     */
    async function acquireLockAndRunEffect() {
      while (active && runningLock.current) {
        const activeChanged = createCancelablePromiseFromCallbacks(activeChangedCallback);
        await Promise.race([runningLock.current, activeChanged.promise]);
        activeChanged.cancel();
      }

      if (!active) {
        return;
      }

      runningLock.current = (async () => {
        try {
          await runEffect();
        } finally {
          runningLock.current = null;
        }
      })();
    }
  }, [effectMemod]);
};
