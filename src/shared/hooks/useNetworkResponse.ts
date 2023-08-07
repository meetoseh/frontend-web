import { ReactElement, useCallback, useMemo } from 'react';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import { useSingletonEffect } from '../lib/useSingletonEffect';
import { setVWC } from '../lib/setVWC';
import { describeError } from '../forms/ErrorBlock';

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

/**
 * Fetches data from the network using the given fetcher, returning both the
 * result (if successful) and the error (if unsuccessful). The fetcher must
 * be memoized, or this hook will re-fetch on every render.
 *
 * @param fetcher A memoized function that fetches data from the network.
 * @param minRefreshTimeMS When refreshing content it can increase user
 *   confidence to show a loading state for at least a short time. This
 *   parameter specifies the minimum time to wait before showing the result.
 *   By default, this is 500ms.
 * @returns The current result and error
 */
export const useNetworkResponse = <T>(
  fetcher: (active: { current: boolean }) => Promise<T | null>,
  minRefreshTimeMS?: number
): NetworkResponse<T> => {
  const result = useWritableValueWithCallbacks<T | null>(() => null);
  const error = useWritableValueWithCallbacks<ReactElement | null>(() => null);

  useSingletonEffect(
    (onDone) => {
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
    [error, result, fetcher]
  );

  const refresh = useCallback(async () => {
    setVWC(result, null);
    setVWC(error, null);
    try {
      const minTime = new Promise((resolve) => setTimeout(resolve, minRefreshTimeMS ?? 500));
      const answer = await fetcher({ current: true });
      await minTime;
      setVWC(result, answer);
    } catch (e) {
      const described = await describeError(e);
      setVWC(error, described);
    }
  }, [result, error, fetcher, minRefreshTimeMS]);

  return useMemo(() => ({ result, error, refresh }), [result, error, refresh]);
};
