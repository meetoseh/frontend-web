import { ReactElement, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/ApiConstants';
import { describeError } from '../../../shared/forms/ErrorBlock';
import { LoginContext } from '../../../shared/contexts/LoginContext';

export type NewUsersChart =
  | {
      loading: true;
      error: ReactElement | null;
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
  const loginContext = useContext(LoginContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReactElement | null>(null);
  const [data, setData] = useState<{ labels: string[]; values: number[] } | null>(null);

  useEffect(() => {
    let active = true;
    fetchDataWrapper();
    return () => {
      active = false;
    };

    async function fetchData() {
      if (loginContext.state !== 'logged-in') {
        return;
      }

      const response = await apiFetch('/api/1/admin/new_users', {}, loginContext);
      if (!active) {
        return;
      }

      if (!response.ok) {
        throw response;
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
        let rendered = await describeError(e);
        if (active) {
          setError(rendered);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
  }, [loginContext]);

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
