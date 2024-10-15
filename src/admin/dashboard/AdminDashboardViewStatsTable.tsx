import {
  ChangeEvent,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { apiFetch } from '../../shared/ApiConstants';
import { Button } from '../../shared/forms/Button';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { convertUsingKeymap, CrudFetcherKeyMap } from '../crud/CrudFetcher';
import {
  AdminDashboardLargeChart,
  AdminDashboardLargeChartItem,
  AdminDashboardLargeChartMonthlyItem,
} from './AdminDashboardLargeChart';
import { AdminDashboardLargeChartPlaceholder } from './AdminDashboardLargeChartPlaceholder';
import styles from './AdminDashboardViewStatsTable.module.css';
import { DashboardTable, DashboardTableProps } from './subComponents/DashboardTable';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';
import { BoxError, chooseErrorFromStatus, DisplayableError } from '../../shared/lib/errors';

type ChartData = {
  labels: string[];
  values: number[];
};

type SubcategoryViews = {
  /**
   * The subcategory this information is referring to
   */
  subcategory: string;

  /**
   * The total number of views in this subcategory as of midnight tonight. This is
   * not affected by the date query parameter.
   */
  totalViews: number;

  /**
   * The total number of unique views in this subcategory as of midnight tonight.
   * This is not affected by the date query parameter.
   */
  totalUniqueViews: number;

  /**
   * Views by day, ending at one day before the date query parameter. The first
   * element is the most recent day, and the last element is the oldest day.
   */
  recentViews: ChartData;

  /**
   * Unique views by day, ending at one day before the date query parameter. The
   * first element is the most recent day, and the last element is the oldest day.
   */
  recentUniqueViews: ChartData;
};

const subcategoryViewsKeyMap: CrudFetcherKeyMap<SubcategoryViews> = {
  total_views: 'totalViews',
  total_unique_views: 'totalUniqueViews',
  recent_views: 'recentViews',
  recent_unique_views: 'recentUniqueViews',
};

type TableData = {
  items: SubcategoryViews[];
};

const tableDataKeyMap: CrudFetcherKeyMap<TableData> = {
  items: (_, v: any[]) => ({
    key: 'items',
    value: v.map((i) => convertUsingKeymap(i, subcategoryViewsKeyMap)),
  }),
};

/**
 * Loads and displays the view statistics table, which updates at midnight.
 * Contains a date picker followed by a table of how many views there were on each day,
 * broken down by subcategory, with a total
 */
export const AdminDashboardViewStatsTable = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  // up to but not including date
  const maxDate = useMemo(() => new Date(Date.now() - 86400000), []);
  const maxDateISO = useMemo(() => maxDate.toISOString().split('T')[0], [maxDate]);

  const [date, setDate] = useState<Date>(maxDate);
  const dateISO = useMemo(() => date.toISOString().split('T')[0], [date]);
  const [data, setData] = useState<{ isoDate: string; data: TableData } | null>(null);
  const [error, setError] = useState<DisplayableError | null>(null);
  const [shouldLoadData, setShouldLoadData] = useState<boolean>(false);
  const [preventingPlaceholder, setPreventingPlaceholder] = useState<boolean>(false);
  const [showingChart, setShowingChart] = useState<{
    dailyCharts: AdminDashboardLargeChartItem[];
    monthlyCharts: AdminDashboardLargeChartMonthlyItem[];
  } | null>(null);
  const [showingTable, setShowingTable] = useState<
    (DashboardTableProps & { title: string }) | null
  >(null);

  const onPlaceholderVisible = useCallback(() => {
    setShouldLoadData(true);
  }, []);

  useEffect(() => {
    if (data !== null) {
      if (!preventingPlaceholder) {
        setPreventingPlaceholder(true);
      }
      return;
    }

    if (!preventingPlaceholder) {
      return;
    }

    let timeout: NodeJS.Timeout | null = setTimeout(() => {
      timeout = null;
      setPreventingPlaceholder(false);
    }, 1000);

    return () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
    };
  }, [data, preventingPlaceholder]);

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        if (!shouldLoadData) {
          return;
        }
        if (loginContextUnch.state !== 'logged-in') {
          return;
        }
        const loginContext = loginContextUnch;

        const isoDate = new Date(date.getTime() + 86400000).toISOString().split('T')[0];
        if (data !== null) {
          if (data.isoDate === isoDate) {
            return;
          }
          setData(null);
          return;
        }

        let active = true;
        loadData();
        return () => {
          active = false;
        };

        async function loadDataInner() {
          let response;
          try {
            response = await apiFetch(
              '/api/1/admin/journey_subcategory_view_stats?' +
                new URLSearchParams({ date: isoDate }),
              { method: 'GET' },
              loginContext
            );
          } catch {
            throw new DisplayableError('connectivity', 'fetch view stats');
          }

          if (!response.ok) {
            throw chooseErrorFromStatus(response.status, 'fetch view stats');
          }

          const raw = await response.json();
          const data = convertUsingKeymap(raw, tableDataKeyMap);

          if (active) {
            setData({ isoDate, data });
          }
        }

        async function loadData() {
          setError(null);
          try {
            await loadDataInner();
          } catch (e) {
            const error =
              e instanceof DisplayableError
                ? e
                : new DisplayableError('client', 'fetch view stats', `${e}`);
            if (active) {
              setError(error);
            }
          }
        }
      },
      [shouldLoadData, data, date]
    )
  );

  const onDateChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const reqDate = e.target.valueAsDate;
      if (reqDate) {
        if (reqDate.getTime() > maxDate.getTime()) {
          setDate(maxDate);
        } else {
          setDate(reqDate);
        }
      }
    },
    [maxDate]
  );

  const [totalViews, totalUniqueViews] = useMemo<[number, number]>(() => {
    if (data === null) {
      return [0, 0];
    }

    let totalViews = 0;
    let totalUniqueViews = 0;

    for (const item of data.data.items) {
      totalViews += item.totalViews;
      totalUniqueViews += item.totalUniqueViews;
    }

    return [totalViews, totalUniqueViews];
  }, [data]);

  const recentLength = useMemo(() => {
    if (data === null) {
      return 30;
    }

    return data.data.items[0].recentViews.values.length;
  }, [data]);

  const recentViewsTotal = useMemo(() => {
    if (data === null) {
      return 0;
    }

    let views = 0;
    for (const item of data.data.items) {
      for (const value of item.recentViews.values) {
        views += value;
      }
    }
    return views;
  }, [data]);

  const recentUniqueViewsTotal = useMemo(() => {
    if (data === null) {
      return 0;
    }

    let views = 0;
    for (const item of data.data.items) {
      for (const value of item.recentUniqueViews.values) {
        views += value;
      }
    }
    return views;
  }, [data]);

  const lastTablePropsRef = useRef<DashboardTableProps | null>(null);
  const tableProps = useMemo<DashboardTableProps | null>(() => {
    if (data === null) {
      return lastTablePropsRef.current;
    }

    const headers = [
      'Subcategory',
      'Views Last 30 Days',
      'Unique Views Last 30 Days',
      'Chart',
      'Table',
    ];

    const items: SubcategoryViews[] = data.data.items.slice();

    items.push({
      subcategory: 'Total',
      totalViews: data.data.items.map((item) => item.totalViews).reduce((a, b) => a + b, 0),
      totalUniqueViews: data.data.items
        .map((item) => item.totalUniqueViews)
        .reduce((a, b) => a + b, 0),
      recentViews: {
        labels: data.data.items[0].recentViews.labels,
        values: data.data.items
          .map((item) => item.recentViews.values)
          .reduce((a, b) => a.map((v, i) => v + b[i]), new Array(recentLength).fill(0)),
      },
      recentUniqueViews: {
        labels: data.data.items[0].recentUniqueViews.labels,
        values: data.data.items
          .map((item) => item.recentUniqueViews.values)
          .reduce((a, b) => a.map((v, i) => v + b[i]), new Array(recentLength).fill(0)),
      },
    });

    const rows: (string | { csv: string; display: ReactElement })[][] = [];

    for (const item of items) {
      const row: (string | { csv: string; display: ReactElement })[] = [
        item.subcategory,
        item.recentViews.values.reduce((a, b) => a + b, 0).toLocaleString(),
        item.recentUniqueViews.values.reduce((a, b) => a + b, 0).toLocaleString(),
      ];
      row.push({
        csv: '',
        display: (
          <Button
            type="button"
            variant="link-small"
            onClick={() => {
              setShowingTable(null);
              setShowingChart({
                dailyCharts: [
                  {
                    identifier: item.subcategory + '-views',
                    name: `${item.subcategory} Views`,
                    labels: item.recentViews.labels,
                    values: item.recentViews.values,
                  },
                  {
                    identifier: item.subcategory + '-unique-views',
                    name: `${item.subcategory} Unique Views`,
                    labels: item.recentUniqueViews.labels,
                    values: item.recentUniqueViews.values,
                  },
                ],
                monthlyCharts: [],
              });
            }}>
            Chart
          </Button>
        ),
      });
      row.push({
        csv: '',
        display: (
          <Button
            type="button"
            variant="link-small"
            onClick={() => {
              setShowingChart(null);
              setShowingTable({
                columnHeaders: ['Date', 'Views', 'Unique Views'],
                rows: item.recentViews.labels.map((label, i) => {
                  return [
                    label,
                    item.recentViews.values[i].toLocaleString(),
                    item.recentUniqueViews.values[i].toLocaleString(),
                  ];
                }),
                title: item.subcategory,
              });
            }}>
            Table
          </Button>
        ),
      });
      rows.push(row);
    }

    return {
      columnHeaders: headers,
      rows,
    };
  }, [data, recentLength]);
  lastTablePropsRef.current = tableProps;

  if (error !== null) {
    return (
      <div className={styles.container}>
        <BoxError error={error} />
      </div>
    );
  }

  if (data === null && !preventingPlaceholder) {
    return <AdminDashboardLargeChartPlaceholder onVisible={onPlaceholderVisible} />;
  }

  return (
    <>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.title}>View Data</div>
          <div className={styles.datePicker}>
            <input
              className={styles.dateInput}
              type="date"
              value={date.toISOString().split('T')[0]}
              onChange={onDateChange}
            />
            <span className={styles.dateInputLabel}>at 11:59:59pm</span>
          </div>
          <div className={styles.helpContainer}>
            <div className={styles.help}>
              <ul>
                {maxDateISO === dateISO && (
                  <>
                    <li>
                      Total Views: <strong>{totalViews.toLocaleString(undefined)}</strong>
                    </li>
                    <li>
                      Total Unique Views:{' '}
                      <strong>{totalUniqueViews.toLocaleString(undefined)}</strong>
                    </li>
                  </>
                )}
                <li>
                  Views Last {recentLength} Days:{' '}
                  <strong>{recentViewsTotal.toLocaleString(undefined)}</strong>
                </li>
                <li>
                  Unique Views Last {recentLength} Days:{' '}
                  <strong>{recentUniqueViewsTotal.toLocaleString(undefined)}</strong>
                </li>
              </ul>
            </div>
          </div>
        </div>
        {tableProps && (
          <div className={styles.tableContainer}>
            <DashboardTable {...tableProps} />
          </div>
        )}
      </div>
      {showingChart && (
        <div className={styles.chartContainer}>
          <AdminDashboardLargeChart {...showingChart} />
        </div>
      )}
      {showingTable && (
        <div className={styles.tableContainer}>
          <div className={styles.title}>{showingTable.title}</div>
          <DashboardTable {...showingTable} />
        </div>
      )}
    </>
  );
};
