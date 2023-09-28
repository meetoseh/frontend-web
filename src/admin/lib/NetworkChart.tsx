import { Fragment, ReactElement, useCallback, useContext } from 'react';
import { NetworkResponse, useNetworkResponse } from '../../shared/hooks/useNetworkResponse';
import { useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import {
  AdminDashboardLargeChartItem,
  AdminDashboardLargeChartProps,
} from '../dashboard/AdminDashboardLargeChart';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { apiFetch } from '../../shared/ApiConstants';
import { PartialStats, PartialStatsItem, parsePartialStats } from './PartialStats';
import { SectionGraphs, SectionStatsMultiday } from '../notifs_dashboard/AdminNotifsDashboard';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { formatNetworkDashboard, formatNetworkError } from '../../shared/lib/networkResponseUtils';
import { setVWC } from '../../shared/lib/setVWC';
import { useUnwrappedValueWithCallbacks } from '../../shared/hooks/useUnwrappedValueWithCallbacks';
import styles from './NetworkChart.module.css';
import { TogglableSmoothExpandable } from '../../shared/components/TogglableSmoothExpandable';
import { fromSnakeToTitleCase } from './fromSnakeToTitleCase';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';

type NetworkChartProps = {
  /**
   * The path or url to where the partial data can be loaded,
   * e.g., '/api/1/admin/sms/partial_sms_send_stats'
   */
  partialDataPath: string;

  /**
   * The path or url to where the historical data can be
   * loaded, e.g., '/api/1/admin/sms/daily_sms_sends'
   */
  historicalDataPath: string;
};

/**
 * Loads and displays a historical data chart and table of recent
 * partial (incomplete) data.
 */
export const NetworkChart = ({ partialDataPath, historicalDataPath }: NetworkChartProps) => {
  const loginContext = useContext(LoginContext);
  const loadPrevented = useWritableValueWithCallbacks(() => true);
  const historicalData = useNetworkResponse<AdminDashboardLargeChartProps>(
    useCallback(async () => {
      if (loginContext.state !== 'logged-in') {
        return null;
      }

      const response = await apiFetch(historicalDataPath, { method: 'GET' }, loginContext);

      if (!response.ok) {
        throw response;
      }

      const data = await response.json();
      return parseChart(data);
    }, [loginContext, historicalDataPath]),
    {
      loadPrevented: loadPrevented,
    }
  );
  const partialData = useNetworkResponse<PartialStats>(
    useCallback(async () => {
      if (loginContext.state !== 'logged-in') {
        return null;
      }

      const response = await apiFetch(partialDataPath, { method: 'GET' }, loginContext);

      if (!response.ok) {
        throw response;
      }

      const data = await response.json();
      return parsePartialStats(data);
    }, [loginContext, partialDataPath])
  );

  const predictedDays = useWritableValueWithCallbacks<number>(() => 2);
  useValueWithCallbacksEffect(
    partialData.result,
    useCallback(
      (r) => {
        if (r === null || r === undefined) {
          return undefined;
        }

        if (r.twoDaysAgo !== undefined) {
          setVWC(predictedDays, 3);
          return undefined;
        }

        if (r.yesterday !== undefined) {
          setVWC(predictedDays, 2);
          return undefined;
        }

        setVWC(predictedDays, 1);
        return undefined;
      },
      [predictedDays]
    )
  );

  const onVisible = useCallback(() => {
    setVWC(loadPrevented, false);
  }, [loadPrevented]);

  return (
    <div className={styles.sectionGraphsAndTodaysStats}>
      <SectionGraphs>
        <RenderGuardedComponent props={historicalData.error} component={formatNetworkError} />
        <RenderGuardedComponent props={partialData.error} component={formatNetworkError} />
        <RenderGuardedComponent
          props={historicalData.result}
          component={(v) =>
            formatNetworkDashboard(v ?? undefined, {
              onVisible,
            })
          }
        />
      </SectionGraphs>
      <RenderGuardedComponent
        props={predictedDays}
        component={(ndays) => (
          <SectionStatsMultiday
            refresh={partialData.refresh}
            days={[
              ...(ndays >= 3
                ? [
                    {
                      name: 'Two Days Ago',
                      content: <PartialStatsDisplay value={partialData} keyName="twoDaysAgo" />,
                    },
                  ]
                : []),
              ...(ndays >= 2
                ? [
                    {
                      name: 'Yesterday',
                      content: <PartialStatsDisplay value={partialData} keyName="yesterday" />,
                    },
                  ]
                : []),
              {
                name: 'Today',
                content: <PartialStatsDisplay value={partialData} keyName="today" />,
              },
            ]}
          />
        )}
      />
    </div>
  );
};

const parseChart = (data: any): AdminDashboardLargeChartProps => {
  const labels: string[] = data.labels;
  const datasets: {
    key: string;
    label: string;
    data: number[];
    breakdown?: Record<string, number[]>;
  }[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === 'labels') {
      continue;
    }

    if (key.endsWith('_breakdown')) {
      continue;
    }

    datasets.push({
      key,
      label: fromSnakeToTitleCase(key),
      data: value as number[],
      breakdown: data[`${key}_breakdown`],
    });
  }

  const dailyCharts: AdminDashboardLargeChartItem[] = [];
  for (const dataset of datasets) {
    dailyCharts.push({
      identifier: dataset.key,
      name: dataset.label,
      labels,
      values: dataset.data,
    });

    if (dataset.breakdown !== undefined) {
      for (const [key, value] of Object.entries(dataset.breakdown)) {
        dailyCharts.push({
          identifier: `${dataset.key}-${key}`,
          name: `${dataset.label} (${key})`,
          labels,
          values: value,
        });
      }
    }
  }

  return {
    dailyCharts,
    monthlyCharts: [],
  };
};

/**
 * Displays partial stats that were loaded from the network.
 */
export const PartialStatsDisplay = ({
  value,
  keyName,
}: {
  value: NetworkResponse<PartialStats>;
  keyName: 'twoDaysAgo' | 'yesterday' | 'today';
}): ReactElement => {
  const unwrapped = useUnwrappedValueWithCallbacks(value.result);
  if (unwrapped === null) {
    return <div style={{ minHeight: '500px', minWidth: 'min(440px, 80vw)' }}></div>;
  }
  if (!unwrapped.hasOwnProperty(keyName)) {
    return <></>;
  }

  const items = unwrapped[keyName];
  if (items === undefined) {
    return <></>;
  }

  // Keeping the natural ordering seems to work best most of the time
  const sortedKeys = items.map((item) => item.key);
  const itemsByKey = items.reduce((acc, item) => {
    acc[item.key] = item;
    return acc;
  }, {} as Record<string, PartialStatsItem>);

  return (
    <>
      {sortedKeys.map((key) => {
        const item = itemsByKey[key];
        return (
          <Fragment key={key}>
            <div className={styles.sectionStatsTodayItem}>
              <div className={styles.sectionStatsTodayItemTitle}>{itemsByKey[key].label}</div>
              <div className={styles.sectionStatsTodayItemValue}>{item.data.toLocaleString()}</div>
              <RenderGuardedComponent props={value.error} component={formatNetworkError} />
            </div>
            {item.breakdown !== undefined && Object.keys(item.breakdown).length > 0 && (
              <div className={styles.sectionStatsTodayItemBreakdown}>
                <TogglableSmoothExpandable>
                  {Object.entries(item.breakdown).map(([breakdownKey, breakdownValue]) => (
                    <div key={breakdownKey} className={styles.sectionStatsTodayItem}>
                      <div className={styles.sectionStatsTodayItemTitle}>{breakdownKey}</div>
                      <div className={styles.sectionStatsTodayItemValue}>
                        {breakdownValue.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </TogglableSmoothExpandable>
              </div>
            )}
          </Fragment>
        );
      })}
    </>
  );
};
