import { ReactElement, useEffect, useRef, useState } from 'react';
import {
  Chart,
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Legend,
  Tooltip,
  ChartDataset,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import styles from './AdminDashboardSmallChart.module.css';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  Filler
);

type AdminDashboardSmallChartProps = {
  /**
   * The name for the chart,m e.g., "New Customers"
   */
  name: string;

  /**
   * This chart is assumed to be some kind of histogram, e.g., new customers
   * per day. This is the sum of all the values in the chart.
   */
  delta: number;

  /**
   * The subtitle text for the chart, e.g., "28 Daily Avg.". Provided as a
   * string since it's simpler to understand than providing the unit
   */
  average: string;

  /**
   * The labels, typically formatted as YYYY-MM-DD
   */
  labels: string[];

  /**
   * The values corresponding with the labels
   */
  values: number[];
};

/**
 * Renders a small square blue chart with minimal labelling
 */
export const AdminDashboardSmallChart = ({
  name,
  delta,
  average,
  labels,
  values,
}: AdminDashboardSmallChartProps): ReactElement => {
  const [dataset, setDataset] = useState<ChartDataset<'line', number[]>>({
    label: name,
    data: values,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 1.0)',
  });
  const chartRef = useRef<Chart<'line'> | null>(null);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    const gradient = chart.ctx.createLinearGradient(
      0,
      chart.chartArea.bottom,
      0,
      chart.chartArea.top
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    // account for 100 top padding
    gradient.addColorStop(1 - 100.0 / chart.height, 'rgba(255, 255, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.4)');

    setDataset({
      label: name,
      data: values,
      backgroundColor: gradient,
      borderColor: 'rgba(255, 255, 255, 1.0)',
      fill: {
        target: 'origin',
        above: gradient,
      },
    });
  }, [name, values]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.name}>{name}</div>
          <div className={styles.average}>{average}</div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.delta}>
            {delta.toLocaleString(undefined, { signDisplay: 'always' })}
          </div>
        </div>
      </div>
      <div className={styles.chartContainer}>
        <Line
          ref={chartRef}
          data={{
            labels,
            datasets: [dataset],
          }}
          options={{
            responsive: true,
            interaction: {
              mode: 'nearest',
            },
            aspectRatio: 1,
            layout: {
              autoPadding: false,
              padding: {
                top: 100,
                bottom: 4,
              },
            },
            elements: {
              point: {
                pointStyle: 'line',
                hitRadius: 10,
              },
              line: {
                tension: 0.4,
              },
            },
            scales: {
              x: {
                display: false,
                grid: {
                  display: false,
                },
                ticks: {
                  display: false,
                },
              },
              y: {
                display: false,
                min: 0,
                grid: {
                  display: false,
                },
                ticks: {
                  display: false,
                },
              },
            },
            plugins: {
              legend: {
                display: false,
              },
            },
          }}
        />
      </div>
    </div>
  );
};
