import { ReactElement, useEffect, useMemo, useState } from 'react';
import {
  Chart,
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Legend,
  Tooltip,
  Colors,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import Popup from 'reactjs-popup';
import '../../assets/fonts.css';
import styles from './AdminDashboardLargeChart.module.css';
import iconStyles from './icons.module.css';
import { Button } from '../../shared/forms/Button';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  Colors
);

export type AdminDashboardLargeChartItem = {
  /**
   * A unique identifier for this chart item.
   */
  identifier: string;

  /**
   * The name for this chart item, e.g., "Daily Active Users"
   */
  name: string;

  /**
   * The labels, either formatted as YYYY-MM-DD or YYYY-MM depending on if
   * it's a daily or monthly chart, respectively
   */
  labels: string[];

  /**
   * The values corresponding to the labels
   */
  values: number[];

  /**
   * If specified, additional tooling for the chart. Typically this is used to
   * e.g., calculate averages over a range.
   */
  help?: () => void;
};

export type AdminDashboardLargeChartMonthlyItem = AdminDashboardLargeChartItem & {
  /**
   * The chart converted to the daily variant so it can be displayed when
   * showing both daily and monthly charts in the same graph
   */
  dailyVariant: AdminDashboardLargeChartItem;
};

type AdminDashboardLargeChartProps = {
  /**
   * Available daily charts; the user can select any number of these to
   * display. If they are displayed alongside monthly charts, the monthly
   * points are rendered on the 15th of each month.
   */
  dailyCharts: AdminDashboardLargeChartItem[];

  /**
   * Available monthly charts; the user can select any number of these to
   * display.
   */
  monthlyCharts: AdminDashboardLargeChartMonthlyItem[];
};

export const AdminDashboardLargeChart = ({
  dailyCharts,
  monthlyCharts,
}: AdminDashboardLargeChartProps): ReactElement => {
  const [selectedDailyCharts, setSelectedDailyCharts] = useState<AdminDashboardLargeChartItem[]>([
    dailyCharts[0],
  ]);
  const [selectedMonthlyCharts, setSelectedMonthlyCharts] = useState<
    AdminDashboardLargeChartMonthlyItem[]
  >([]);
  const [primaryChart, setPrimaryChart] = useState<AdminDashboardLargeChartItem>(dailyCharts[0]);

  // many of the plugins don't take kindly to changing the data, especially the colors plugin
  const [chartCounter, setChartCounter] = useState(0);

  useEffect(() => {
    if (selectedDailyCharts.length === 0 && selectedMonthlyCharts.length === 0) {
      setSelectedDailyCharts([dailyCharts[0]]);
      return;
    }

    if (
      !selectedDailyCharts.includes(primaryChart) &&
      !selectedMonthlyCharts.some((c) => c === primaryChart)
    ) {
      setPrimaryChart(selectedDailyCharts[0] || selectedMonthlyCharts[0]);
    }
  }, [selectedDailyCharts, selectedMonthlyCharts, primaryChart, dailyCharts]);

  useEffect(() => {
    let newSelDaily = [];
    let changedSelDaily = false;
    for (let i = 0; i < selectedDailyCharts.length; i++) {
      if (!dailyCharts.includes(selectedDailyCharts[i])) {
        changedSelDaily = true;
        let matchingIdentifier = dailyCharts.find(
          (c) => c.identifier === selectedDailyCharts[i].identifier
        );
        if (matchingIdentifier !== undefined) {
          newSelDaily.push(matchingIdentifier);
        }
      }
    }

    if (changedSelDaily) {
      setSelectedDailyCharts(newSelDaily);
    }
  }, [dailyCharts, selectedDailyCharts]);

  useEffect(() => {
    let newSelMonthly = [];
    let changedSelMonthly = false;

    for (let i = 0; i < selectedMonthlyCharts.length; i++) {
      if (!monthlyCharts.includes(selectedMonthlyCharts[i])) {
        changedSelMonthly = true;
        let matchingIdentifier = monthlyCharts.find(
          (c) => c.identifier === selectedMonthlyCharts[i].identifier
        );
        if (matchingIdentifier !== undefined) {
          newSelMonthly.push(matchingIdentifier);
        }
      }
    }

    if (changedSelMonthly) {
      setSelectedMonthlyCharts(newSelMonthly);
    }
  }, [monthlyCharts, selectedMonthlyCharts]);

  const data = useMemo(() => {
    setChartCounter((c) => c + 1);
    if (selectedDailyCharts.length + selectedMonthlyCharts.length === 0) {
      return {
        labels: ['Loading'],
        datasets: [
          {
            label: 'Loading',
            data: [0],
          },
        ],
      };
    }

    if (selectedDailyCharts.length > 0) {
      return {
        labels: selectedDailyCharts[0].labels,
        datasets: [
          ...selectedDailyCharts.map((chart) => ({
            label: chart.name,
            data: chart.values,
          })),
          ...selectedMonthlyCharts.map((chart) => ({
            label: chart.name,
            data: chart.dailyVariant.values,
          })),
        ],
      };
    }

    return {
      labels: selectedMonthlyCharts[0].labels,
      datasets: selectedMonthlyCharts.map((chart) => ({
        label: chart.name,
        data: chart.values,
      })),
    };
  }, [selectedDailyCharts, selectedMonthlyCharts]);

  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>
        <div className={styles.primaryTitleRow}>
          <div className={styles.primaryTitleContainer}>
            <div className={styles.primaryTitle}>{primaryChart.name}</div>
            <Popup
              trigger={
                <div className={styles.moreContainer}>
                  <span className={iconStyles.more}></span>
                </div>
              }
              position="right top"
              on="click"
              closeOnDocumentClick
              mouseLeaveDelay={300}
              mouseEnterDelay={0}
              arrow={false}>
              <div className={styles.popupContainer}>
                {dailyCharts.length > 0 && <div className={styles.popupTitle}>Daily Charts</div>}
                {dailyCharts.map((chart) => (
                  <button
                    key={chart.identifier}
                    type="button"
                    className={`${styles.popupItem} ${
                      selectedDailyCharts.includes(chart) ? styles.popupItemSelected : ''
                    }`}
                    onClick={() => {
                      if (selectedDailyCharts.includes(chart)) {
                        setSelectedDailyCharts((sel) => sel.filter((c) => c !== chart));
                      } else {
                        setSelectedDailyCharts((sel) => sel.concat(chart));
                      }
                    }}>
                    <div className={styles.popupItemCheckboxContainer}>
                      <span
                        className={`${styles.checkbox} ${
                          selectedDailyCharts.includes(chart)
                            ? iconStyles.checkboxChecked
                            : iconStyles.checkboxUnchecked
                        }`}></span>
                    </div>
                    <div className={styles.popupItemName}>{chart.name}</div>
                  </button>
                ))}
                {monthlyCharts.length > 0 && (
                  <div className={styles.popupTitle}>Monthly Charts</div>
                )}
                {monthlyCharts.map((chart) => (
                  <button
                    key={chart.identifier}
                    type="button"
                    className={`${styles.popupItem} ${
                      selectedMonthlyCharts.includes(chart) ? styles.popupItemSelected : ''
                    }`}
                    onClick={() => {
                      if (selectedMonthlyCharts.includes(chart)) {
                        setSelectedMonthlyCharts(selectedMonthlyCharts.filter((c) => c !== chart));
                      } else {
                        setSelectedMonthlyCharts(selectedMonthlyCharts.concat(chart));
                      }
                    }}>
                    <div className={styles.popupItemCheckboxContainer}>
                      <span
                        className={`${styles.checkbox} ${
                          selectedMonthlyCharts.includes(chart)
                            ? iconStyles.checkboxChecked
                            : iconStyles.checkboxUnchecked
                        }`}></span>
                    </div>
                    <div className={styles.popupItemName}>{chart.name}</div>
                  </button>
                ))}
              </div>
            </Popup>
          </div>
          {primaryChart.help && (
            <div className={styles.helpContainer}>
              <Button type="button" variant="link-small-upper" onClick={primaryChart.help}>
                Details
              </Button>
            </div>
          )}
        </div>
        {selectedDailyCharts.length + selectedMonthlyCharts.length > 1 ? (
          <div className={styles.secondaryTitle}>
            {(() => {
              const chartNames = selectedDailyCharts
                .filter((chart) => chart !== primaryChart)
                .map((chart) => chart.name)
                .concat(
                  selectedMonthlyCharts
                    .filter((chart) => chart !== primaryChart)
                    .map((chart) => chart.name)
                );

              if (chartNames.length === 1) {
                return chartNames[0];
              } else if (chartNames.length === 2) {
                return chartNames.join(' and ');
              }

              return (
                chartNames.slice(0, chartNames.length - 1).join(', ') +
                ', and ' +
                chartNames[chartNames.length - 1]
              );
            })()}
          </div>
        ) : null}
      </div>

      <div className={styles.chartContainer}>
        {selectedDailyCharts.length + selectedMonthlyCharts.length > 0 ? (
          <Line
            key={chartCounter.toString()}
            options={{
              responsive: true,
              interaction: {
                mode: 'nearest',
              },
              elements: {
                point: {
                  pointStyle: 'line',
                },
              },
              scales: {
                x: {
                  ticks: {
                    callback: (value, index, ticks) => {
                      const usingDaily = selectedDailyCharts.length > 0;
                      const label = usingDaily
                        ? selectedDailyCharts[0].labels[index]
                        : selectedMonthlyCharts[0].labels[index];
                      if (label === undefined) {
                        // bad state
                        return value;
                      }
                      const isMonthly = label.length === 7;

                      const isoFormatted = isMonthly ? label + '-01' : label;

                      const dayOfMonth = parseInt(isoFormatted.split('-')[2]);
                      if (!isMonthly && dayOfMonth !== 1) {
                        return null;
                      }

                      return new Date(isoFormatted).toLocaleDateString('en-US', {
                        timeZone: 'UTC',
                        month: 'short',
                      });
                    },
                  },
                },
                y: {
                  grid: {
                    display: false,
                  },

                  ticks: {
                    precision: 0,
                  },
                },
              },
              plugins: {
                legend: {
                  display: true,
                  position: 'bottom',
                },
              },
            }}
            data={data}
          />
        ) : null}
      </div>
    </div>
  );
};
