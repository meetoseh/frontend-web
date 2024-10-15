import { useCallback, useContext, useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';
import { chooseErrorFromStatus, DisplayableError } from '../../../shared/lib/errors';

export type NewUsersChart =
  | {
      loading: true;
      error: DisplayableError | null;
      labels: null;
      values: null;
    }
  | {
      loading: false;
      labels: string[];
      values: number[];
    };

/**
 * A hook-like function for loading the new users chart
 */
export const useNewUsersChart = (): NewUsersChart => {
  const loginContextRaw = useContext(LoginContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DisplayableError | null>(null);
  const [data, setData] = useState<{ labels: string[]; values: number[] } | null>(null);

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback((loginContextUnch) => {
      if (loginContextUnch.state !== 'logged-in') {
        return;
      }
      const loginContext = loginContextUnch;

      let active = true;
      fetchDataWrapper();
      return () => {
        active = false;
      };

      async function fetchData() {
        let response;
        try {
          response = await apiFetch('/api/1/admin/new_users', {}, loginContext);
        } catch {
          throw new DisplayableError('connectivity', 'fetch new users chart');
        }
        if (!active) {
          return;
        }

        if (!response.ok) {
          throw chooseErrorFromStatus(response.status, 'fetch new users chart');
        }

        const data = await response.json();
        if (!active) {
          return;
        }

        setData(data);
      }

      async function fetchDataWrapper() {
        setLoading(true);
        setError(null);
        try {
          await fetchData();
        } catch (e) {
          let rendered =
            e instanceof DisplayableError
              ? e
              : new DisplayableError('client', 'fetch new users chart', `${e}`);
          if (active) {
            setError(rendered);
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }
    }, [])
  );

  return useMemo(() => {
    if (loading || error !== null || data === null) {
      return {
        loading: true,
        error,
        labels: null,
        values: null,
      };
    }

    return {
      loading: false,
      labels: data.labels,
      values: data.values,
    };
  }, [loading, error, data]);
};
