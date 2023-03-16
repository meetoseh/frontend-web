import { ReactElement, useEffect, useMemo, useState } from 'react';
import { CrudFormElement } from '../../crud/CrudFormElement';
import { NewUsersChart } from '../hooks/useNewUsersChart';
import { DashboardTable } from './DashboardTable';
import styles from './NewUsersDetails.module.css';

type NewUsersDetailsProps = { chart: NewUsersChart };

const dateOptions: Intl.DateTimeFormatOptions = {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
};

/**
 * Renders the given chart using a summary section and a table which is better
 * suited to really digging into the data compared to a chart.
 */
export const NewUsersDetails = ({ chart }: NewUsersDetailsProps): ReactElement => {
  const [from, setFrom] = useState<Date>(() => new Date());
  const [to, setTo] = useState<Date>(() => new Date());

  useEffect(() => {
    if (chart.loading) {
      return;
    }

    let from = new Date();
    let to = new Date(chart.labels[chart.labels.length - 1]);
    for (let i = 0; i < chart.values.length; i++) {
      if (chart.values[i] > 0) {
        from = new Date(chart.labels[i]);
        break;
      }
    }

    setFrom(from);
    setTo(to);
  }, [chart]);

  const fromIndex = useMemo(() => {
    if (chart.loading) {
      return -1;
    }

    const fromKey = from.toISOString().split('T')[0];
    return chart.labels.findIndex((label) => label === fromKey);
  }, [from, chart]);

  const toIndex = useMemo(() => {
    if (chart.loading) {
      return -1;
    }

    const toKey = to.toISOString().split('T')[0];
    return chart.labels.findIndex((label) => label === toKey);
  }, [to, chart]);

  const total = useMemo(() => {
    if (chart.loading || fromIndex === -1 || toIndex === -1 || fromIndex > toIndex) {
      return 0;
    }

    let total = 0;
    for (let i = fromIndex; i <= toIndex; i++) {
      total += chart.values[i];
    }
    return total;
  }, [chart, fromIndex, toIndex]);

  const average = useMemo(() => {
    if (
      chart.loading ||
      fromIndex === -1 ||
      toIndex === -1 ||
      fromIndex >= toIndex ||
      total === 0
    ) {
      return 0;
    }

    return total / (toIndex - fromIndex + 1);
  }, [chart, fromIndex, toIndex, total]);

  const bestDay = useMemo<[Date, number]>(() => {
    if (chart.loading || fromIndex === -1 || toIndex === -1 || fromIndex > toIndex) {
      return [new Date(), 0];
    }

    let bestDayIndex = fromIndex;
    for (let i = fromIndex; i < toIndex; i++) {
      if (chart.values[i] > chart.values[bestDayIndex]) {
        bestDayIndex = i;
      }
    }
    return [new Date(chart.labels[bestDayIndex]), chart.values[bestDayIndex]];
  }, [chart, fromIndex, toIndex]);

  const leastSquaresRegression = useMemo<[number, number]>(() => {
    if (chart.loading || fromIndex === -1 || toIndex === -1 || fromIndex > toIndex) {
      return [0, 0];
    }

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = fromIndex; i <= toIndex; i++) {
      const x = i - fromIndex;
      const y = chart.values[i];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const n = toIndex - fromIndex + 1;
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return [slope, intercept];
  }, [chart, fromIndex, toIndex]);

  const error = useMemo(() => {
    if (chart.loading || fromIndex === -1 || toIndex === -1 || fromIndex > toIndex) {
      return 0;
    }

    let sum = 0;
    for (let i = fromIndex; i <= toIndex; i++) {
      const x = i - fromIndex;
      const y = chart.values[i];
      const yHat = leastSquaresRegression[0] * x + leastSquaresRegression[1];
      sum += (y - yHat) * (y - yHat);
    }

    return Math.sqrt(sum / (toIndex - fromIndex + 1));
  }, [chart, fromIndex, toIndex, leastSquaresRegression]);

  const tableInfo = useMemo<{ columnHeaders: string[]; rows: string[][] }>(() => {
    const headers = ['Date', 'New Users'];
    if (chart.loading || fromIndex === -1 || toIndex === -1 || fromIndex > toIndex) {
      return { columnHeaders: headers, rows: [] };
    }

    const rows: string[][] = [];
    for (let i = fromIndex; i <= toIndex; i++) {
      rows.push([chart.labels[i], chart.values[i].toString()]);
    }
    return { columnHeaders: headers, rows };
  }, [chart, fromIndex, toIndex]);

  return (
    <div className={styles.container}>
      <div className={styles.title}>New Users Details</div>
      <div className={styles.dateRange}>
        <CrudFormElement title="From">
          <input
            type="date"
            className={styles.dateInput}
            value={from.toISOString().split('T')[0]}
            onChange={(e) => {
              if (e.target.valueAsDate) {
                setFrom(e.target.valueAsDate);
              }
            }}
          />
        </CrudFormElement>
        <CrudFormElement title="To">
          <input
            type="date"
            className={styles.dateInput}
            value={to.toISOString().split('T')[0]}
            onChange={(e) => {
              if (e.target.valueAsDate) {
                setTo(e.target.valueAsDate);
              }
            }}
          />
        </CrudFormElement>
      </div>
      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          Between {from.toLocaleString(undefined, dateOptions)} and{' '}
          {to.toLocaleString(undefined, dateOptions)} there were{' '}
          <span className={styles.summaryItemValue}>{total} new users</span> - an average of{' '}
          <span className={styles.summaryItemValue}>{average.toFixed(2)} per day</span>.
        </div>
        <div className={styles.summaryItem}>
          The best day was {bestDay[0].toLocaleString(undefined, dateOptions)} with {bestDay[1]} new
          users.
        </div>
        <div className={styles.summaryItem}>
          The least-squares regression is{' '}
          <span className={styles.summaryItemValue}>
            y = {leastSquaresRegression[0].toFixed(2)}x + {leastSquaresRegression[1].toFixed(2)}
          </span>
          . The root-mean-square deviation is{' '}
          <span className={styles.summaryItemValue}>{error.toFixed(2)}</span>.
        </div>
      </div>
      <div className={styles.tableContainer}>
        <DashboardTable columnHeaders={tableInfo.columnHeaders} rows={tableInfo.rows} />
      </div>
    </div>
  );
};
