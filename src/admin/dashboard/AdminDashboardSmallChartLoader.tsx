import { ReactElement } from 'react';
import { AdminDashboardSmallChart } from './AdminDashboardSmallChart';
import styles from './AdminDashboardSmallChartLoader.module.css';
import iconStyles from './icons.module.css';
import { AdminDashboardTopBlock } from './AdminDashboardTopBlock';
import { NewUsersChart } from './hooks/useNewUsersChart';
import { BoxError } from '../../shared/lib/errors';

type AdminDashboardSmallChartLoaderProps = {
  /**
   * The new users chart data, which is loaded by the parent component.
   */
  newUsersChart: NewUsersChart;
};

/**
 * Loads the data for the small blue chart on the right side of the admin dashboard,
 * and renders the chart when the data is ready, with a placeholder to prevent
 * the page from jumping around while the data is loading.
 */
export const AdminDashboardSmallChartLoader = ({
  newUsersChart,
}: AdminDashboardSmallChartLoaderProps): ReactElement => {
  return (
    <>
      {newUsersChart.loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingInnerContainer}>
            {newUsersChart.error === null ? (
              <div className={styles.loadingTextContainer}>Loading data...</div>
            ) : (
              <BoxError error={newUsersChart.error} />
            )}
          </div>
        </div>
      ) : (
        <AdminDashboardSmallChart
          name="New Users"
          delta={newUsersChart.values.reduce((a, b) => a + b, 0)}
          average={`${Math.floor(
            newUsersChart.values.reduce((a, b) => a + b, 0) / newUsersChart.values.length
          ).toLocaleString()} Daily Avg.`}
          labels={newUsersChart.labels}
          values={newUsersChart.values}
        />
      )}

      <AdminDashboardTopBlock
        iconClassName={iconStyles.totalMembers}
        label={
          newUsersChart.loading
            ? 'Joined XXXX-XX-XX'
            : `Joined ${newUsersChart.labels[newUsersChart.labels.length - 1]}`
        }
        value={newUsersChart.loading ? 0 : newUsersChart.values[newUsersChart.values.length - 1]}
      />
    </>
  );
};
