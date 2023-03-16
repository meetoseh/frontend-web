import styles from './AdminDashboardLargeChartPlaceholder.module.css';

/**
 * Shows a component that can be used as a placeholder for a large chart
 * while data is loading.
 */
export const AdminDashboardLargeChartPlaceholder = () => {
  return (
    <div className={styles.container}>
      <div className={styles.innerContainer}>
        <div className={styles.textContainer}>Loading data...</div>
      </div>
    </div>
  );
};
