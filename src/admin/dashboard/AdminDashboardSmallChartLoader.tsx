import { ReactElement, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../../shared/ApiConstants';
import { LoginContext } from '../../shared/LoginContext';
import { AdminDashboardSmallChart } from './AdminDashboardSmallChart';
import styles from './AdminDashboardSmallChartLoader.module.css';

/**
 * Loads the data for the small blue chart on the right side of the admin dashboard,
 * and renders the chart when the data is ready, with a placeholder to prevent
 * the page from jumping around while the data is loading.
 */
export const AdminDashboardSmallChartLoader = (): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [data, setData] = useState<{ labels: string[]; values: number[] } | null>(null);

  useEffect(() => {
    let active = true;
    fetchData();
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
        const text = await response.text();
        if (!active) {
          return;
        }

        console.error('Failed to load new users data', text);
        return;
      }

      const data = await response.json();
      if (!active) {
        return;
      }

      setData(data);
    }
  }, [loginContext]);

  return data === null ? (
    <div className={styles.loadingContainer}>
      <div className={styles.loadingInnerContainer}>
        <div className={styles.loadingTextContainer}>Loading data...</div>
      </div>
    </div>
  ) : (
    <AdminDashboardSmallChart
      name="New Users"
      delta={data.values.reduce((a, b) => a + b, 0)}
      average={`${Math.floor(
        data.values.reduce((a, b) => a + b, 0) / data.values.length
      ).toLocaleString()} Daily Avg.`}
      labels={data.labels}
      values={data.values}
    />
  );
};
