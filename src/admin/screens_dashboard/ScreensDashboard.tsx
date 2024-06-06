import { ReactElement } from 'react';
import styles from '../notifs_dashboard/AdminNotifsDashboard.module.css';
import { NetworkChart } from '../lib/NetworkChart';

/**
 * The admin screens dashboard, which is intended to inspecting what screens are
 * being presented (and if any are over/under logging)
 */
export const AdminScreensDashboard = (): ReactElement => {
  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>Screens Dashboard</div>
      <div className={styles.sections}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Client Flow Stats</div>
          <div className={styles.sectionContent}>
            <NetworkChart
              partialDataPath="/api/1/admin/client_flows/partial_client_flow_stats"
              historicalDataPath="/api/1/admin/client_flows/client_flow_stats"
            />
          </div>
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Client Screen Stats</div>
          <div className={styles.sectionContent}>
            <NetworkChart
              partialDataPath="/api/1/admin/client_flows/partial_client_screen_stats"
              historicalDataPath="/api/1/admin/client_flows/client_screen_stats"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
