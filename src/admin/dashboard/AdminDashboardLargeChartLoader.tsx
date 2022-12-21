import { ReactElement, useContext, useEffect, useRef, useState } from 'react';
import {
  AdminDashboardLargeChart,
  AdminDashboardLargeChartItem,
  AdminDashboardLargeChartMonthlyItem,
} from './AdminDashboardLargeChart';
import '../../assets/fonts.css';
import styles from './AdminDashboardLargeChartLoader.module.css';
import { apiFetch } from '../../shared/ApiConstants';
import { LoginContext } from '../../shared/LoginContext';

const DAILY_CHARTS_ORDER = [
  'dau',
  'retention-0day',
  'retention-1day',
  'retention-7day',
  'retention-30day',
  'retention-90day',
];

const MONTHLY_CHARTS_ORDER = ['mau'];

export const AdminDashboardLargeChartLoader = (): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [remainingToLoad, setRemainingToLoad] = useState(
    DAILY_CHARTS_ORDER.length + MONTHLY_CHARTS_ORDER.length
  );
  const dailyChartsRef = useRef<{ [key: string]: AdminDashboardLargeChartItem }>({});
  const monthlyChartsRef = useRef<{ [key: string]: AdminDashboardLargeChartMonthlyItem }>({});

  // dau
  useEffect(() => {
    let active = true;
    fetchDAU();
    return () => {
      active = false;
    };

    async function fetchDAU() {
      if (loginContext.state !== 'logged-in') {
        return;
      }
      const response = await apiFetch('/api/1/admin/daily_active_users', {}, loginContext);

      if (!active) {
        return;
      }

      if (!response.ok) {
        const text = await response.text();
        if (!active) {
          return;
        }

        console.error('Failed to fetch daily active users', text);
        setRemainingToLoad((l) => l - 1);
        return;
      }

      const data: { labels: string[]; values: number[] } = await response.json();
      if (!active) {
        return;
      }

      dailyChartsRef.current.dau = {
        identifier: 'dau',
        name: 'Daily Active Users',
        labels: data.labels,
        values: data.values,
      };
      setRemainingToLoad((l) => l - 1);
    }
  }, [loginContext]);

  // mau
  useEffect(() => {
    let active = true;
    fetchMAU();
    return () => {
      active = false;
    };

    async function fetchMAU() {
      if (loginContext.state !== 'logged-in') {
        return;
      }
      const responses = await Promise.all([
        apiFetch('/api/1/admin/monthly_active_users/month', {}, loginContext),
        apiFetch('/api/1/admin/monthly_active_users/day', {}, loginContext),
      ]);

      if (!active) {
        return;
      }

      const failedResponses = responses.filter((r) => !r.ok);
      if (failedResponses.length > 0) {
        const failedTexts = await Promise.all(failedResponses.map((r) => r.text()));
        if (!active) {
          return;
        }

        console.error('Failed to fetch monthly active users', failedResponses, failedTexts);
        setRemainingToLoad((l) => l - 1);
        return;
      }

      const datas = await Promise.all(responses.map((r) => r.json()));
      if (!active) {
        return;
      }

      monthlyChartsRef.current.mau = {
        identifier: 'mau',
        name: 'Monthly Active Users',
        labels: datas[0].labels,
        values: datas[0].values,
        dailyVariant: {
          identifier: 'mau-daily',
          name: 'Monthly Active Users',
          labels: datas[1].labels,
          values: datas[1].values,
        },
      };
      setRemainingToLoad((l) => l - 1);
    }
  }, [loginContext]);

  // retention
  useEffect(() => {
    let active = true;
    [0, 1, 7, 30, 90].forEach((day) => {
      fetchRetention(day);
    });
    return () => {
      active = false;
    };

    async function fetchRetention(day: number) {
      if (loginContext.state !== 'logged-in') {
        return;
      }
      const response = await apiFetch(`/api/1/admin/retention_stats/${day}day`, {}, loginContext);

      if (!active) {
        return;
      }

      if (!response.ok) {
        const text = await response.text();
        if (!active) {
          return;
        }

        console.error(`Failed to fetch ${day}-day retention`, text);
        setRemainingToLoad((l) => l - 1);
        return;
      }

      const data: {
        period: string;
        period_label: string;
        labels: string[];
        retained: number[];
        unretained: number[];
        retention_rate: number[];
      } = await response.json();
      if (!active) {
        return;
      }

      dailyChartsRef.current[`retention-${day}day`] = {
        identifier: `retention-${day}day`,
        name: `${day} Day Retention`,
        labels: data.labels,
        values: data.retention_rate,
      };
      setRemainingToLoad((l) => l - 1);
    }
  }, [loginContext]);

  return remainingToLoad > 0 ||
    Object.keys(dailyChartsRef.current).length + Object.keys(monthlyChartsRef.current).length ===
      0 ? (
    <div className={styles.loadingContainer}>
      <div className={styles.loadingInnerContainer}>
        <div className={styles.loadingTextContainer}>Loading data...</div>
      </div>
    </div>
  ) : (
    <AdminDashboardLargeChart
      dailyCharts={DAILY_CHARTS_ORDER.map(
        (identifier) => dailyChartsRef.current[identifier]
      ).filter(Boolean)}
      monthlyCharts={MONTHLY_CHARTS_ORDER.map(
        (identifier) => monthlyChartsRef.current[identifier]
      ).filter(Boolean)}
    />
  );
};
