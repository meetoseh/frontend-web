import { ReactElement, useCallback, useContext, useMemo } from 'react';
import {
  Callbacks,
  ValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../lib/Callbacks';
import { setVWC } from '../lib/setVWC';
import { describeError } from '../forms/ErrorBlock';
import { useValueWithCallbacksEffect } from './useValueWithCallbacksEffect';
import { LoginContext, LoginContextValueLoggedIn } from '../contexts/LoginContext';
import { useValuesWithCallbacksEffect } from './useValuesWithCallbacksEffect';

export type NetworkResponseError<T> = {
  /** For when the fetcher rejected */
  type: 'error';
  result: undefined;
  error: ReactElement;
  /** Switches to the loading state */
  refresh: () => void;
  /** replaces the value with the given one */
  replace: (value: T) => void;
};

export type NetworkResponseLoading = {
  /** For when we are executing the fetcher */
  type: 'loading';
  result: undefined;
  error: null;
  refresh: null;
  replace: null;
};

export type NetworkResponseLoadPrevented = {
  /** For when the loadPrevented flag is set */
  type: 'load-prevented';
  result: undefined;
  error: null;
  refresh: null;
  replace: null;
};

export type NetworkResponseSuccess<T> = {
  /** For when the result from fetcher is not null */
  type: 'success';
  result: T;
  error: null;
  /** Switches to the loading state */
  refresh: () => void;
  /** replaces the value with the given one */
  replace: (value: T) => void;
};

export type NetworkResponseUnavailable<T> = {
  /** For when the result from fetcher is null */
  type: 'unavailable';
  result: null;
  error: null;
  refresh: () => void;
  replace: (value: T) => void;
};

export type NetworkResponse<T> =
  | NetworkResponseError<T>
  | NetworkResponseLoadPrevented
  | NetworkResponseLoading
  | NetworkResponseUnavailable<T>
  | NetworkResponseSuccess<T>;

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

  /**
   * If specified, we will refresh if any of the callbacks are invoked
   * on these vwcs.
   */
  dependsOn?: ValueWithCallbacks<unknown>[];
};

/**
 * Fetches data from the network using the given fetcher, returning both the
 * result (if successful) and the error (if unsuccessful). The fetcher must
 * be memoized, or this hook will re-fetch on every render. Only calls the
 * fetcher when the user is logged in, and provides the logged-in login context
 *
 * @param fetcher A memoized function that fetches data from the network.
 * @param opts Additional options for configuring the hook
 * @returns The current result and error
 */
export const useNetworkResponse = <T>(
  fetcher: (
    active: ValueWithCallbacks<boolean>,
    loginContext: LoginContextValueLoggedIn
  ) => Promise<T | null>,
  opts?: UseNetworkResponseOpts
): ValueWithCallbacks<NetworkResponse<T>> => {
  const loginContextRaw = useContext(LoginContext);
  const result = useWritableValueWithCallbacks<NetworkResponse<T>>(() => ({
    type: 'loading',
    result: undefined,
    error: null,
    refresh: null,
    replace: null,
  }));

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

  const refresh = useCallback(async () => {
    if (loadPrevented.get() || result.get().type === 'loading') {
      return;
    }

    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      return;
    }
    const loginContext = loginContextUnch;

    setVWC(result, {
      type: 'loading',
      result: undefined,
      error: null,
      refresh: null,
      replace: null,
    });
    try {
      const minTime = new Promise((resolve) => setTimeout(resolve, minRefreshTimeMS));
      const answer = await fetcher(createWritableValueWithCallbacks(true), loginContext);
      await minTime;
      if (result.get().type !== 'loading') {
        return;
      }
      if (answer === null) {
        setVWC(result, {
          type: 'unavailable',
          result: null,
          error: null,
          refresh,
          replace,
        });
      } else {
        setVWC(result, {
          type: 'success',
          result: answer,
          error: null,
          refresh,
          replace,
        });
      }
    } catch (e) {
      const described = await describeError(e);
      if (result.get().type !== 'loading') {
        return;
      }
      setVWC(result, {
        type: 'error',
        result: undefined,
        error: described,
        refresh,
        replace,
      });
    }
  }, [result, fetcher, minRefreshTimeMS, loadPrevented, loginContextRaw]);

  const replace = useCallback((value: T) => {
    if (loadPrevented.get() || result.get().type === 'loading') {
      return;
    }

    setVWC(result, {
      type: 'success',
      result: value,
      error: null,
      refresh,
      replace,
    });
  }, []);

  useValuesWithCallbacksEffect(
    [loginContextRaw.value, ...(opts?.dependsOn ?? [])],
    useCallback(() => {
      if (loadPrevented.get()) {
        setVWC(
          result,
          {
            type: 'load-prevented',
            result: undefined,
            error: null,
            refresh: null,
            replace: null,
          },
          (a, b) => a.type === b.type
        );
        return;
      }

      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        return;
      }
      const loginContext = loginContextUnch;

      const active = createWritableValueWithCallbacks(true);
      fetchWrapper();
      return () => {
        setVWC(active, false);
      };

      async function fetchWrapper() {
        try {
          const answer = await fetcher(active, loginContext);
          if (active.get()) {
            if (answer === null) {
              setVWC(result, {
                type: 'unavailable',
                result: null,
                error: null,
                refresh,
                replace,
              });
            } else {
              setVWC(result, {
                type: 'success',
                result: answer,
                error: null,
                refresh,
                replace,
              });
            }
          }
        } catch (e) {
          if (!active.get()) {
            return;
          }

          const described = await describeError(e);
          if (active.get()) {
            setVWC(result, {
              type: 'error',
              result: undefined,
              error: described,
              refresh,
              replace,
            });
          }
        }
      }
    }, [result, fetcher, loadPrevented, refresh])
  );
  useValueWithCallbacksEffect(
    loadPrevented,
    useCallback(
      (value) => {
        if (value) {
          setVWC(
            result,
            {
              type: 'load-prevented',
              result: undefined,
              error: null,
              refresh: null,
              replace: null,
            },
            (a, b) => a.type === b.type
          );
        } else {
          refresh();
        }
        return undefined;
      },
      [result, refresh]
    )
  );

  return result;
};
