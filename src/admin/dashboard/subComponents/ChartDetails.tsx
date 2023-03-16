import { Dispatch, ReactElement, SetStateAction } from 'react';
import { DashboardTable, DashboardTableProps } from './DashboardTable';
import styles from './ChartDetails.module.css';
import { CrudFormElement } from '../../crud/CrudFormElement';

type ChartDetailsProps = {
  /**
   * The title for modal
   */
  title: string;

  /**
   * A date filter is assumed; this is the start date
   */
  from: Date;

  /**
   * A date filter is assumed; this is the end date (inclusive)
   */
  to: Date;

  /**
   * Used to update the start date
   */
  setFrom: Dispatch<SetStateAction<Date>> | ((from: Date) => void);

  /**
   * Used to update the end date
   */
  setTo: Dispatch<SetStateAction<Date>> | ((from: Date) => void);

  /**
   * This is typically a div styled with ChartDetails.module.css, specifically:
   * - container uses `.summary`
   * - each item uses `.summaryItem`
   * - emphasis uses `strong`
   */
  summary: ReactElement;

  /**
   * The props used to create the table
   */
  table: DashboardTableProps;
};

/**
 * The standard layout handler for describing a chart in greater detail,
 * with a date range filter for which part of the chart is being described.
 * This comes with a few summary statistics (e.g., average, total, linear fit)
 * and a table of the data.
 */
export const ChartDetails = ({
  title,
  from,
  to,
  setFrom,
  setTo,
  summary,
  table,
}: ChartDetailsProps): ReactElement => {
  return (
    <div className={styles.container}>
      <div className={styles.title}>{title}</div>
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
      {summary}
      <div className={styles.tableContainer}>
        <DashboardTable columnHeaders={table.columnHeaders} rows={table.rows} />
      </div>
    </div>
  );
};
