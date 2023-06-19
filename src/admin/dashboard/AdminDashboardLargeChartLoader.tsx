import { ReactElement, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdminDashboardLargeChart,
  AdminDashboardLargeChartItem,
  AdminDashboardLargeChartMonthlyItem,
} from './AdminDashboardLargeChart';
import '../../assets/fonts.css';
import detailStyles from './subComponents/ChartDetails.module.css';
import { apiFetch } from '../../shared/ApiConstants';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { addModalWithCallbackToRemove, ModalContext } from '../../shared/contexts/ModalContext';
import { ModalWrapper } from '../../shared/ModalWrapper';
import { AdminDashboardLargeChartPlaceholder } from './AdminDashboardLargeChartPlaceholder';
import { ChartDetails } from './subComponents/ChartDetails';
import { DashboardTableProps } from './subComponents/DashboardTable';

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
  const modalContext = useContext(ModalContext);
  const [remainingToLoad, setRemainingToLoad] = useState(
    DAILY_CHARTS_ORDER.length + MONTHLY_CHARTS_ORDER.length
  );
  const dailyChartsRef = useRef<{ [key: string]: AdminDashboardLargeChartItem }>({});
  const monthlyChartsRef = useRef<{ [key: string]: AdminDashboardLargeChartMonthlyItem }>({});

  const [showRetentionDetails, setShowRetentionDetails] = useState<RetentionDetailsProps | null>(
    null
  );
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
        help: () => {
          setShowRetentionDetails({
            day,
            labels: data.labels,
            retained: data.retained,
            unretained: data.unretained,
            retentionRate: data.retention_rate,
          });
        },
      };
      setRemainingToLoad((l) => l - 1);
    }
  }, [loginContext]);

  // retention modal
  useEffect(() => {
    if (showRetentionDetails === null) {
      return;
    }

    return addModalWithCallbackToRemove(
      modalContext.setModals,
      <ModalWrapper onClosed={() => setShowRetentionDetails(null)}>
        <RetentionDetails {...showRetentionDetails} />
      </ModalWrapper>
    );
  }, [modalContext.setModals, showRetentionDetails]);

  return remainingToLoad > 0 ||
    Object.keys(dailyChartsRef.current).length + Object.keys(monthlyChartsRef.current).length ===
      0 ? (
    <AdminDashboardLargeChartPlaceholder />
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

type RetentionDetailsProps = {
  day: number;
  labels: string[];
  retained: number[];
  unretained: number[];
  retentionRate: number[];
};

const dateOptions: Intl.DateTimeFormatOptions = {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
};

const RetentionDetails = ({
  day,
  labels,
  retained,
  unretained,
  retentionRate,
}: RetentionDetailsProps): ReactElement => {
  const [from, setFrom] = useState<Date>(() => {
    // if any dates have a non-zero number of retained/unretained, that's our first date,
    // otherwise we start at the first date

    const firstNonZeroIndex = labels.findIndex((_, i) => {
      return retained[i] > 0 || unretained[i] > 0;
    });

    if (firstNonZeroIndex === -1) {
      return new Date(labels[0]);
    }

    return new Date(labels[firstNonZeroIndex]);
  });

  const [to, setTo] = useState<Date>(() => {
    return new Date(labels[labels.length - 1]);
  });

  const fromIndex = useMemo(() => {
    const fromStr = from.toISOString().split('T')[0];
    return labels.indexOf(fromStr);
  }, [from, labels]);

  const toIndex = useMemo(() => {
    const toStr = to.toISOString().split('T')[0];
    return labels.indexOf(toStr);
  }, [to, labels]);

  const totalRetained = useMemo(() => {
    if (fromIndex > toIndex || fromIndex === -1 || toIndex === -1) {
      return 0;
    }

    return retained.slice(fromIndex, toIndex + 1).reduce((a, b) => a + b, 0);
  }, [fromIndex, toIndex, retained]);

  const totalUnretained = useMemo(() => {
    if (fromIndex > toIndex || fromIndex === -1 || toIndex === -1) {
      return 0;
    }

    return unretained.slice(fromIndex, toIndex + 1).reduce((a, b) => a + b, 0);
  }, [fromIndex, toIndex, unretained]);

  const table = useMemo<DashboardTableProps>(() => {
    if (fromIndex > toIndex || fromIndex === -1 || toIndex === -1) {
      return {
        columnHeaders: ['Date', 'Retained', 'Unretained', 'Retention Rate'],
        rows: [['N/A', 'N/A', 'N/A', 'N/A']],
      };
    }
    return {
      columnHeaders: ['Date', 'Retained', 'Unretained', 'Retention Rate'],
      rows: labels.slice(fromIndex, toIndex + 1).map((label, i) => {
        return [
          label,
          retained[fromIndex + i].toString(),
          unretained[fromIndex + i].toString(),
          `${(retentionRate[fromIndex + i] * 100).toFixed(2)}%`,
        ];
      }),
    };
  }, [fromIndex, toIndex, retained, unretained, retentionRate, labels]);

  return (
    <ChartDetails
      title={`Details for ${day}-day retention`}
      from={from}
      to={to}
      setFrom={setFrom}
      setTo={setTo}
      summary={
        <div className={detailStyles.summary}>
          <div className={detailStyles.summaryItem}>
            Between {from.toLocaleString(undefined, dateOptions)} and{' '}
            {to.toLocaleString(undefined, dateOptions)} there were{' '}
            <strong>{totalRetained + totalUnretained} new users</strong>
          </div>
          <div className={detailStyles.summaryItem}>
            <strong>{totalUnretained}</strong> users did not take any action more than {day} day
            {day === 1 ? '' : 's'} after sign up
          </div>
          <div className={detailStyles.summaryItem}>
            <strong>{totalRetained}</strong> users took at least one action more than {day} day
            {day === 1 ? '' : 's'} after sign up
          </div>
          <div className={detailStyles.summaryItem}>
            <strong>
              {(totalRetained + totalUnretained === 0
                ? 0
                : (totalRetained / (totalRetained + totalUnretained)) * 100
              ).toFixed(2)}
              % of users
            </strong>{' '}
            took at least one action more than {day} day{day === 1 ? '' : 's'} after sign up
          </div>
        </div>
      }
      table={table}
    />
  );
};
