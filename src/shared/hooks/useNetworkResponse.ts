import { ReactElement, useCallback, useEffect, useMemo } from 'react';
import { Callbacks, ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import { setVWC } from '../lib/setVWC';
import { describeError } from '../forms/ErrorBlock';
import { useValueWithCallbacksEffect } from './useValueWithCallbacksEffect';
import { useSingletonEffect } from '../lib/useSingletonEffect';

export type NetworkResponse<T> = {
  /**
   * The last response from the network
   */
  result: ValueWithCallbacks<T | null>;
  /**
   * The last error from the network
   */
  error: ValueWithCallbacks<ReactElement | null>;
  /**
   * Refreshes the value from the network
   */
  refresh: () => Promise<void>;
};

export type UseNetworkResponseOpts = {
  /**
   * When refreshing content it can increase user confidence to show a loading
   * state for at least a short time. This parameter specifies the minimum time
   * to wait before showing the result. By default, this is 500ms.
   */
  minRefreshTimeMS?: number;

  /**
   * True if loading should be prevented, false to load as normal. This is
   * useful to prevent loading the network request until the component becomes
   * visible, for example.
   */
  loadPrevented?: ValueWithCallbacks<boolean>;
};

/**
 * Fetches data from the network using the given fetcher, returning both the
 * result (if successful) and the error (if unsuccessful). The fetcher must
 * be memoized, or this hook will re-fetch on every render.
 *
 * @param fetcher A memoized function that fetches data from the network.
 * @param opts Additional options for configuring the hook
 * @returns The current result and error
 */
export const useNetworkResponse = <T>(
  fetcher: (active: { current: boolean }) => Promise<T | null>,
  opts?: UseNetworkResponseOpts
): NetworkResponse<T> => {
  const result = useWritableValueWithCallbacks<T | null>(() => null);
  const error = useWritableValueWithCallbacks<ReactElement | null>(() => null);

  const minRefreshTimeMS = opts?.minRefreshTimeMS ?? 500;
  const rawLoadPrevented = opts?.loadPrevented;
  const loadPrevented = useMemo(() => {
    if (rawLoadPrevented === undefined) {
      return {
        get: () => false,
        callbacks: new Callbacks<undefined>(),
      };
    }
    return rawLoadPrevented;
  }, [rawLoadPrevented]);

  useSingletonEffect(
    (onDone) => {
      if (loadPrevented.get()) {
        onDone();
        return;
      }

      let active = { current: true };
      fetchWrapper();
      return () => {
        active.current = false;
      };

      async function fetchWrapper() {
        try {
          const answer = await fetcher(active);
          if (active.current) {
            setVWC(error, null);
            setVWC(result, answer);
          }
        } catch (e) {
          if (!active.current) {
            return;
          }

          const described = await describeError(e);
          if (active.current) {
            setVWC(result, null);
            setVWC(error, described);
          }
        } finally {
          onDone();
        }
      }
    },
    [error, result, fetcher, loadPrevented]
  );

  const refresh = useCallback(async () => {
    if (loadPrevented.get()) {
      return;
    }

    setVWC(result, null);
    setVWC(error, null);
    try {
      const minTime = new Promise((resolve) => setTimeout(resolve, minRefreshTimeMS));
      const answer = await fetcher({ current: true });
      await minTime;
      setVWC(result, answer);
    } catch (e) {
      const described = await describeError(e);
      setVWC(error, described);
    }
  }, [result, error, fetcher, minRefreshTimeMS, loadPrevented]);

  useValueWithCallbacksEffect(
    loadPrevented,
    useCallback(
      (value) => {
        if (value) {
          setVWC(result, null);
          setVWC(error, null);
        } else {
          refresh();
        }
        return undefined;
      },
      [result, error, refresh]
    )
  );

  return useMemo(() => ({ result, error, refresh }), [result, error, refresh]);
};
