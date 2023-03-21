import {
  ChangeEvent,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiFetch } from '../../shared/ApiConstants';
import { Button } from '../../shared/forms/Button';
import { describeError, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { LoginContext } from '../../shared/LoginContext';
import { convertUsingKeymap, CrudFetcherKeyMap } from '../crud/CrudFetcher';
import styles from './AdminDashboardUTMConversionStatsTable.module.css';
import { DashboardTable, DashboardTableProps } from './subComponents/DashboardTable';

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

  /**
   * When the server fetched this data. May be (much) earlier than the request
   * if the data is cacheable (i.e, from a previous day), since the data is
   * carefully constructed to ensure that new information only effects the
   * current day's data.
   */
  retrievedAt: number;
};

const tableDataKeyMap: CrudFetcherKeyMap<TableData> = {
  rows: (_, v: any[]) => ({
    key: 'rows',
    value: v.map((row) => convertUsingKeymap(row, rowDataKeyMap)),
  }),
  retrieved_at: 'retrievedAt',
};

/**
 * Shows the UTM conversion stats table for a given day, where the user can
 * select which day.
 */
export const AdminDashboardUTMConversionStatsTable = (): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [date, setDate] = useState(() => new Date());
  const [error, setError] = useState<ReactElement | null>(null);
  const [tableData, setTableData] = useState<TableData>(() => ({
    rows: [],
    retrievedAt: 0,
  }));
  const [showingHelp, setShowingHelp] = useState(false);

  const toggleHelp = useCallback(() => {
    setShowingHelp((h) => !h);
  }, []);

  useEffect(() => {
    let active = true;
    fetchTableData();
    return () => {
      active = false;
    };

    async function fetchTableDataInner() {
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
      const parsed = convertUsingKeymap(data, tableDataKeyMap);
      if (active) {
        setTableData(parsed);
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
  }, [loginContext, date]);

  const onDateChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.valueAsDate) {
      setDate(e.target.valueAsDate);
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

  const prettyDate = useMemo(() => {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, [date]);

  return (
    <div className={styles.container}>
      {error && <ErrorBlock>{error}</ErrorBlock>}
      <div className={styles.header}>
        <div className={styles.title}>Attributable Visitors</div>
        <div className={styles.datePicker}>
          <input
            className={styles.dateInput}
            type="date"
            value={date.toISOString().split('T')[0]}
            onChange={onDateChange}
          />
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
                  <strong>visits</strong> - number of clicks on {prettyDate}
                </li>
                <li>
                  <strong>last click signups</strong> - number of users who clicked on {prettyDate}{' '}
                  and then signed up on {prettyDate} without clicking a different utm in between
                </li>
                <li>
                  <strong>any click signups</strong> - number of users who clicked on {prettyDate}{' '}
                  and then signed up on {prettyDate}. All last clicks are also any clicks.
                </li>
                <li>
                  <strong>preexisting</strong> - number of users who already had an account and then
                  clicked on {prettyDate}
                </li>
                <li>
                  <strong>holdover last click signups</strong> - number of users who clicked{' '}
                  <em>before</em> {prettyDate} and then signed up on {prettyDate} without clicking a
                  different utm in between
                </li>
                <li>
                  <strong>holdover any click signups</strong> - number of users who clicked{' '}
                  <em>before</em> {prettyDate} and then signed up on {prettyDate}. All last clicks
                  are also any clicks.
                </li>
                <li>
                  <strong>holdover preexisting</strong> - number of users who clicked while logged
                  out <em>before</em> {prettyDate}, then logged in on {prettyDate} to an account
                  created before they clicked.
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
