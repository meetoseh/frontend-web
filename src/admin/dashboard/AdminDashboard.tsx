import { ReactElement } from 'react';
import '../../assets/fonts.css';
import styles from './AdminDashboard.module.css';
import iconStyles from './icons.module.css';
import { AdminDashboardSimpleTopBlock } from './AdminDashboardSimpleTopBlock';
import { AdminDashboardLargeChartLoader } from './AdminDashboardLargeChartLoader';
import { AdminDashboardSmallChartLoader } from './AdminDashboardSmallChartLoader';
import { AdminDashboardNotificationSettingsBlocksLoader } from './AdminDashboardNotificationSettingsBlocksLoader';
import { useNewUsersChart } from './hooks/useNewUsersChart';
import { AdminDashboardSecondLargeChartLoader } from './AdminDashboardSecondLargeChartLoader';
import { AdminDashboardUTMConversionStatsTable } from './AdminDashboardUTMConversionStatsTable';
import { AdminDashboardViewStatsTable } from './AdminDashboardViewStatsTable';
import { AdminDashboardJourneyFeedback } from './AdminDashboardJourneyFeedback';

export const AdminDashboard = (): ReactElement => {
  const newUsersChart = useNewUsersChart();

  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>Oseh Dashboard</div>
      <div className={styles.topBlocksContainer}>
        <AdminDashboardSimpleTopBlock
          path="/api/1/admin/total_users"
          label="Total Members"
          iconClassName={iconStyles.totalMembers}
        />
        <AdminDashboardSimpleTopBlock
          path="/api/1/admin/total_interactive_prompt_sessions"
          label="Total Views"
          iconClassName={iconStyles.totalViews}
        />
        <AdminDashboardSimpleTopBlock
          path="/api/1/admin/total_instructors"
          label="Total Instructors"
          iconClassName={iconStyles.totalInstructors}
        />
        <AdminDashboardSimpleTopBlock
          path="/api/1/admin/total_journeys"
          label="Total Journeys"
          iconClassName={iconStyles.totalJourneys}
        />
      </div>
      <div className={styles.centerContainer}>
        <div className={styles.centerLeftContainer}>
          <AdminDashboardLargeChartLoader />
        </div>
        <div className={styles.centerRightContainer}>
          <AdminDashboardSmallChartLoader newUsersChart={newUsersChart} />
        </div>
      </div>
      <div className={styles.topBlocksContainer}>
        <AdminDashboardNotificationSettingsBlocksLoader />
      </div>
      <div className={styles.centerContainer}>
        <div className={styles.centerLeftContainer}>
          <AdminDashboardSecondLargeChartLoader newUsersChart={newUsersChart} />
        </div>
      </div>
      <div className={styles.centerContainer}>
        <AdminDashboardUTMConversionStatsTable />
      </div>
      <div className={styles.centerContainer}>
        <AdminDashboardViewStatsTable />
      </div>
      <div className={styles.centerContainer}>
        <AdminDashboardJourneyFeedback />
      </div>
    </div>
  );
};
