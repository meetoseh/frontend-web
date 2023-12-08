import { ChangeEvent, ReactElement, useCallback, useContext, useMemo, useState } from 'react';
import {
  dateToLocaleISODateString,
  isoDateStringToLocaleDate,
} from '../../shared/lib/dateToLocaleISODateString';
import styles from './AdminDashboardPhoneVerificationsChartAndTable.module.css';
import { CrudFormElement } from '../crud/CrudFormElement';
import { ErrorBlock, describeError } from '../../shared/forms/ErrorBlock';
import { Button } from '../../shared/forms/Button';
import {
  AdminDashboardLargeChart,
  AdminDashboardLargeChartProps,
} from './AdminDashboardLargeChart';
import { DashboardTable, DashboardTableProps } from './subComponents/DashboardTable';
import { apiFetch } from '../../shared/ApiConstants';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { combineClasses } from '../../shared/lib/combineClasses';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';

type Data = {
  /**
   * The labels for the x-axis of the chart.
   */
  labels: string[];

  /**
   * The total number of phone verifications approved on the corresponding label
   */
  total: number[];

  /**
   * The number of users with phone verifications approved on the corresponding
   * label; this is total - duplicated users
   */
  users: number[];

  /**
   * The numebr of users who had their first phone verification approved on the
   * corresponding label
   */
  first: number[];
};

/**
 * Shows both a chart for how many phone verifications there are per day, with
 * a button to switch to a table view. The table view shows the same data, but
 * in a table.
 */
export const AdminDashboardPhoneVerificationsChartAndTable = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const [endDate, setEndDate] = useState<Date>(() => new Date());
  const [startDate, setStartDate] = useState<Date>(
    () => new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
  );
  const [data, setData] = useState<{ from: string; to: string; data: Data } | null>(null);
  const [error, setError] = useState<ReactElement | null>(null);
  const [display, setDisplay] = useState<'chart' | 'table'>('chart');

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        if (loginContextUnch.state !== 'logged-in') {
          return;
        }
        const loginContext = loginContextUnch;

        const startISO = dateToLocaleISODateString(startDate);
        const endISO = dateToLocaleISODateString(endDate);

        if (data !== null && data.from === startISO && data.to === endISO) {
          return;
        }

        let active = true;
        fetchData();
        return () => {
          active = false;
        };

        async function fetchDataInner(): Promise<Data> {
          const response = await apiFetch(
            '/api/1/admin/daily_phone_verifications?' +
              new URLSearchParams({
                from_date: startISO,
                to_date: endISO,
              }),
            { method: 'GET' },
            loginContext
          );

          if (!response.ok) {
            throw response;
          }

          return await response.json();
        }

        async function fetchData() {
          setError(null);
          try {
            const data = await fetchDataInner();
            if (active) {
              setData({ from: startISO, to: endISO, data });
            }
          } catch (e) {
            const error = await describeError(e);
            if (active) {
              setError(error);
            }
          }
        }
      },
      [data, startDate, endDate]
    )
  );

  const onStartDateChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.valueAsDate) {
      setStartDate(isoDateStringToLocaleDate(e.target.value));
    }
  }, []);

  const onEndDateChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.valueAsDate) {
      setEndDate(isoDateStringToLocaleDate(e.target.value));
    }
  }, []);

  const onChartDisplay = useCallback(() => {
    setDisplay('chart');
  }, []);

  const onTableDisplay = useCallback(() => {
    setDisplay('table');
  }, []);

  const prettyStartDate = useMemo(() => {
    return startDate.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, [startDate]);

  const prettyEndDate = useMemo(() => {
    return endDate.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, [endDate]);

  const prettyDateRangeWithPrep = useMemo(() => {
    if (prettyStartDate === prettyEndDate) {
      return `on ${prettyStartDate}`;
    }
    return `between ${prettyStartDate} and ${prettyEndDate}`;
  }, [prettyStartDate, prettyEndDate]);

  const [totalTotal, totalUsers, totalFirst] = useMemo(() => {
    if (!data) {
      return [0, 0, 0];
    }

    return [
      data.data.total.reduce((a, b) => a + b, 0),
      data.data.users.reduce((a, b) => a + b, 0),
      data.data.first.reduce((a, b) => a + b, 0),
    ];
  }, [data]);

  const chartProps = useMemo<AdminDashboardLargeChartProps>(() => {
    if (!data) {
      return { dailyCharts: [], monthlyCharts: [] };
    }

    return {
      dailyCharts: [
        {
          identifier: 'total',
          name: 'Total',
          labels: data.data.labels,
          values: data.data.total,
        },
        {
          identifier: 'users',
          name: 'Users',
          labels: data.data.labels,
          values: data.data.users,
        },
        {
          identifier: 'first',
          name: 'First',
          labels: data.data.labels,
          values: data.data.first,
        },
      ],
      monthlyCharts: [],
    };
  }, [data]);

  const tableProps = useMemo<DashboardTableProps>(() => {
    const columnHeaders = ['Date', 'Total', 'Users', 'First'];

    if (!data) {
      return { columnHeaders, rows: [] };
    }

    return {
      columnHeaders,
      rows: data.data.labels.map((label, i) => {
        return [
          label,
          data.data.total[i].toLocaleString(),
          data.data.users[i].toLocaleString(),
          data.data.first[i].toLocaleString(),
        ];
      }),
    };
  }, [data]);

  return (
    <div className={styles.container}>
      {error && <ErrorBlock>{error}</ErrorBlock>}
      <div className={styles.header}>
        <div className={styles.title}>Phone Verifications</div>
        <div className={styles.fromToContainer}>
          <CrudFormElement title="From">
            <input
              className={styles.dateInput}
              type="date"
              value={dateToLocaleISODateString(startDate)}
              onChange={onStartDateChange}
            />
          </CrudFormElement>

          <CrudFormElement title="To">
            <input
              className={styles.dateInput}
              type="date"
              value={dateToLocaleISODateString(endDate)}
              onChange={onEndDateChange}
            />
          </CrudFormElement>
        </div>
        <div className={styles.helpContainer}>
          <div className={styles.help}>
            <ul>
              <li>
                <strong>{totalTotal}</strong> approved phone verifications {prettyDateRangeWithPrep}
              </li>
              <li>
                <strong>{totalUsers}</strong> unique users with approved phone verifications{' '}
                {prettyDateRangeWithPrep}
              </li>
              <li>
                <strong>{totalFirst}</strong> users with their first approved phone verification{' '}
                {prettyDateRangeWithPrep}
              </li>
            </ul>
          </div>
        </div>

        <div className={styles.displayToggle}>
          <Button
            type="button"
            variant={display === 'chart' ? 'filled' : 'outlined'}
            onClick={onChartDisplay}>
            Chart
          </Button>
          <Button
            type="button"
            variant={display === 'table' ? 'filled' : 'outlined'}
            onClick={onTableDisplay}>
            Table
          </Button>
        </div>

        <div className={combineClasses(styles.content, styles[`content-${display}`])}>
          {display === 'chart' && data !== null && <AdminDashboardLargeChart {...chartProps} />}
          {display === 'table' && data !== null && <DashboardTable {...tableProps} />}
        </div>
      </div>
    </div>
  );
};
