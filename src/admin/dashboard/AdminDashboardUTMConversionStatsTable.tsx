import { ChangeEvent, ReactElement, useCallback, useContext, useMemo, useState } from 'react';
import { apiFetch } from '../../shared/ApiConstants';
import { Button } from '../../shared/forms/Button';
import { describeError, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { convertUsingKeymap, CrudFetcherKeyMap } from '../crud/CrudFetcher';
import styles from './AdminDashboardUTMConversionStatsTable.module.css';
import { DashboardTable, DashboardTableProps } from './subComponents/DashboardTable';
import { CrudFormElement } from '../crud/CrudFormElement';
import {
  dateToLocaleISODateString,
  isoDateStringToLocaleDate,
} from '../../shared/lib/dateToLocaleISODateString';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';

/**
 * Describes basic utm information, only enforcing that source is present.
 */
type UTM = {
  source: string;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
};

/**
 * Parses a utm object from the format returned by the backend, which can
 * omit null values.
 */
const parseUTM = ({
  source,
  medium,
  campaign,
  content,
  term,
}: {
  source: string;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;
}): UTM => {
  return {
    source,
    medium: medium ?? null,
    campaign: campaign ?? null,
    content: content ?? null,
    term: term ?? null,
  };
};

/**
 * Returns the canonical representation of the given utm, which is always the
 * same for two identical utms.
 * @param utm The utm to get the canonical representation of
 * @returns The canonical representation of the given utm
 */
const getCanonicalUTM = (utm: UTM): string => {
  return new URLSearchParams([
    ...(utm.campaign !== null ? [['utm_campaign', utm.campaign]] : []),
    ...(utm.content !== null ? [['utm_content', utm.content]] : []),
    ...(utm.medium !== null ? [['utm_medium', utm.medium]] : []),
    ...(utm.source !== null ? [['utm_source', utm.source]] : []),
    ...(utm.term !== null ? [['utm_term', utm.term]] : []),
  ]).toString();
};

/**
 * A row in the table
 */
type RowData = {
  /**
   * The UTM this row is for
   */
  utm: UTM;

  /**
   * The iso-formatted date (YYYY-MM-DD) that this row represents the stats
   * for
   */
  retrievedFor: string;

  /**
   * How many visits by this utm on this day
   */
  visits: number;

  /**
   * The number of users who, on a previous day, clicked the UTM, and then on
   * this day created an account. Always at least as big as holdover last click
   * signups.
   */
  holdoverPreexisting: number;

  /**
   * The number of users who, on a previous day, clicked
   * the UTM, and then on this day created an account, without clicking any
   * other UTMs in the meantime.
   *
   * _This value can be negative_. Consider the following case:
   *
   * - visitor K clicks utm A on day 0 (e.g., their iphone)
   * - visitor V clicks utm B on day 1 (e.g., their pc)
   * - user creates account on day 2 (for simplicity on some third device, irrelevant where it is)
   * - user is associated with K on day 3 - this means on day 3, holdover_last_click_signups for A is 1, B is 0
   * - user is associated with V on day 4 - this means on day 4, holdover_last_click_signups for A is -1, B is 1
   */
  holdoverLastClickSignups: number;

  /**
   * The number of users who, on a previous day, clicked the UTM, and then on
   * this day created an account. Always at least as big as holdover last click
   * signups.
   */
  holdoverAnyClickSignups: number;

  /**
   * The number of users who, on this day, clicked the UTM, and then on this day
   * we associated them to a user which was created prior to the UTM click.
   */
  preexisting: number;

  /**
   * The number of users who, on this day, clicked the UTM, and then on this day
   * we associated them to a user which was created after the utm click, with no
   * other utm clicks for that user created after this utm.
   */
  lastClickSignups: number;

  /**
   * The number of users who, on this day, clicked the UTM, and then on this day
   * we associated them to a user which was created after the utm click. Always
   * at least as big as last click signups.
   */
  anyClickSignups: number;
};

const rowDataKeyMap: CrudFetcherKeyMap<RowData> = {
  utm: (_, v) => ({ key: 'utm', value: parseUTM(v) }),
  retrieved_for: 'retrievedFor',
  holdover_preexisting: 'holdoverPreexisting',
  holdover_last_click_signups: 'holdoverLastClickSignups',
  holdover_any_click_signups: 'holdoverAnyClickSignups',
  last_click_signups: 'lastClickSignups',
  any_click_signups: 'anyClickSignups',
};

/**
 * The data for the table
 */
type TableData = {
  /**
   * The rows in the table
   */
  rows: RowData[];
};

const tableDataKeyMap: CrudFetcherKeyMap<TableData> = {
  rows: (_, v: any[]) => ({
    key: 'rows',
    value: v.map((row) => convertUsingKeymap(row, rowDataKeyMap)),
  }),
};

type UpdateableTableData = {
  /**
   * Maps from the canonical string representation of a UTM to the row data
   * for that UTM.
   */
  utmToRow: Map<string, RowData>;
};

/**
 * Converts the given single-day table data into a format more suitable
 * for being updated in-place with other data.
 */
const convertToUpdateable = (data: TableData): UpdateableTableData => {
  const utmToRow = new Map<string, RowData>();
  for (let i = 0; i < data.rows.length; i++) {
    const row = data.rows[i];
    const canonical = getCanonicalUTM(row.utm);
    utmToRow.set(canonical, row);
  }

  return { utmToRow };
};

/**
 * Updates the base table data in-place with the data from the other table data.
 *
 * @param base The base table data to update
 * @param other The other table data to update the base with
 * @returns base
 */
const updateTableData = (base: UpdateableTableData, other: TableData): UpdateableTableData => {
  for (let rowIndex = 0; rowIndex < other.rows.length; rowIndex++) {
    const row = other.rows[rowIndex];
    const canonical = getCanonicalUTM(row.utm);
    const baseRow = base.utmToRow.get(canonical);
    if (baseRow === undefined) {
      base.utmToRow.set(canonical, row);
    } else {
      baseRow.visits += row.visits;
      baseRow.holdoverPreexisting += row.holdoverPreexisting;
      baseRow.holdoverLastClickSignups += row.holdoverLastClickSignups;
      baseRow.holdoverAnyClickSignups += row.holdoverAnyClickSignups;
      baseRow.preexisting += row.preexisting;
      baseRow.lastClickSignups += row.lastClickSignups;
      baseRow.anyClickSignups += row.anyClickSignups;
    }
  }
  return base;
};

/**
 * Converts back from the updateable table data representation to the
 * standard table data representation.
 *
 * @param updateable The updateable table data to convert
 * @returns The standard table data representation
 */
const convertUpdateableToTableData = (updateable: UpdateableTableData): TableData => {
  const rows = Array.from(updateable.utmToRow.values());
  rows.sort((a, b) => b.visits - a.visits);
  return {
    rows,
  };
};

/**
 * Shows the UTM conversion stats table for a given day, where the user can
 * select which day.
 */
export const AdminDashboardUTMConversionStatsTable = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(startDate);
  const [error, setError] = useState<ReactElement | null>(null);
  const [tableData, setTableData] = useState<TableData>(() => ({
    rows: [],
    retrievedAt: 0,
  }));
  const [showingHelp, setShowingHelp] = useState(false);

  const toggleHelp = useCallback(() => {
    setShowingHelp((h) => !h);
  }, []);

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        if (loginContextUnch.state !== 'logged-in') {
          return;
        }
        const loginContext = loginContextUnch;

        let active = true;
        fetchTableData();
        return () => {
          active = false;
        };

        async function fetchOneDayTableDataInner(date: Date): Promise<[Date, TableData]> {
          const response = await apiFetch(
            '/api/1/admin/utm_conversion_stats?' +
              new URLSearchParams({
                year: date.getUTCFullYear().toString(),
                month: (date.getUTCMonth() + 1).toString(),
                day: date.getUTCDate().toString(),
              }),
            {},
            loginContext
          );

          if (!response.ok) {
            throw response;
          }

          const data = await response.json();
          return [date, convertUsingKeymap(data, tableDataKeyMap)];
        }

        async function fetchTableDataInner() {
          const maxConcurrent = 5;
          const result = convertToUpdateable({ rows: [] });
          const runningPromises: Promise<[Date, TableData]>[] = [];
          const dateToPromise = new Map<number, Promise<[Date, TableData]>>();

          const utcStartDate = new Date(dateToLocaleISODateString(startDate));
          const utcEndDate = new Date(dateToLocaleISODateString(endDate));

          let nextDate = utcStartDate;
          while (nextDate.getTime() <= utcEndDate.getTime() || runningPromises.length > 0) {
            if (!active) {
              return;
            }

            while (
              runningPromises.length < maxConcurrent &&
              nextDate.getTime() <= utcEndDate.getTime()
            ) {
              const promise = fetchOneDayTableDataInner(nextDate);
              runningPromises.push(promise);
              dateToPromise.set(nextDate.getTime(), promise);
              nextDate = new Date(nextDate.getTime() + 24 * 60 * 60 * 1000);
            }

            const [finDate, finTable] = await Promise.race(runningPromises);
            const finPromise = dateToPromise.get(finDate.getTime());

            if (finPromise === undefined) {
              throw new Error('Promise not found');
            }

            runningPromises.splice(runningPromises.indexOf(finPromise), 1);
            dateToPromise.delete(finDate.getTime());

            updateTableData(result, finTable);
          }

          const tableData = convertUpdateableToTableData(result);
          if (active) {
            setTableData(tableData);
          }
        }

        async function fetchTableData() {
          setError(null);
          try {
            await fetchTableDataInner();
          } catch (e) {
            const error = await describeError(e);
            if (active) {
              setError(error);
            }
          }
        }
      },
      [startDate, endDate]
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

  const tableProps = useMemo<DashboardTableProps>(() => {
    return {
      columnHeaders: [
        'source',
        'medium',
        'campaign',
        'content',
        'term',
        'visits',
        'last click signups',
        'any click signups',
        'preexisting',
        'holdover last click signups',
        'holdover any click signups',
        'holdover preexisting',
      ],
      rows: tableData.rows.map((row) => [
        row.utm.source,
        row.utm.medium ?? '',
        row.utm.campaign ?? '',
        row.utm.content ?? '',
        row.utm.term ?? '',
        row.visits.toString(),
        row.lastClickSignups.toString(),
        row.anyClickSignups.toString(),
        row.preexisting.toString(),
        row.holdoverLastClickSignups.toString(),
        row.holdoverAnyClickSignups.toString(),
        row.holdoverPreexisting.toString(),
      ]),
    };
  }, [tableData]);

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

  return (
    <div className={styles.container}>
      {error && <ErrorBlock>{error}</ErrorBlock>}
      <div className={styles.header}>
        <div className={styles.title}>Attributable Visitors</div>
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
          <Button type="button" variant="link-small" onClick={toggleHelp}>
            {showingHelp ? 'Hide' : 'Show'} Column Explanations
          </Button>
          {showingHelp && (
            <div className={styles.help}>
              <ul>
                <li>
                  <strong>source, medium, campaign, content, term</strong> -{' '}
                  <a href="https://en.wikipedia.org/wiki/UTM_parameters">UTM parameters</a>
                </li>
                <li>
                  <strong>visits</strong> - number of clicks {prettyDateRangeWithPrep}
                </li>
                <li>
                  <strong>last click signups</strong> - number of users who clicked{' '}
                  {prettyDateRangeWithPrep} and then signed up the same day without clicking a
                  different utm in between
                </li>
                <li>
                  <strong>any click signups</strong> - number of users who clicked{' '}
                  {prettyDateRangeWithPrep} and then signed up the same day. Will always be greater
                  than or equal to last click signups.
                </li>
                <li>
                  <strong>preexisting</strong> - number of users who already had an account and then
                  clicked {prettyDateRangeWithPrep}
                </li>
                <li>
                  <strong>holdover last click signups</strong> - number of users who signed up
                  {prettyDateRangeWithPrep} without clicking a different utm in between, but who
                  clicked at least a day before signing up.
                </li>
                <li>
                  <strong>holdover any click signups</strong> - number of signed up{' '}
                  {prettyDateRangeWithPrep}, but who clicked at least a day before signing up. Will
                  always be greater than or equal to holdover last click signups.
                </li>
                <li>
                  <strong>holdover preexisting</strong> - number of users who clicked{' '}
                  {prettyDateRangeWithPrep}, for which at the time we didn't know they already had
                  an account, and at least a day later we found out they already had an account.
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className={styles.tableContainer}>
        <DashboardTable {...tableProps} />
      </div>
    </div>
  );
};
