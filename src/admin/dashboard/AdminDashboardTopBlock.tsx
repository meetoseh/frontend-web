import { ReactElement } from 'react';
import '../../assets/fonts.css';
import styles from './AdminDashboardTopBlock.module.css';

type AdminDashboardTopBlockProps = {
  /**
   * The class to apply to the element which should act as the
   * icon for this number, e.g., a silhouette for total members
   */
  iconClassName: string;

  /**
   * The value to display, as an integer
   */
  value: number;

  /**
   * The label to display, e.g., "Total Members"
   */
  label: string;
};

export const AdminDashboardTopBlock = ({
  iconClassName,
  value,
  label,
}: AdminDashboardTopBlockProps): ReactElement => {
  return (
    <div className={styles.container}>
      <div className={styles.innerContainer}>
        <div className={styles.iconContainer}>
          <div className={iconClassName}></div>
        </div>

        <div className={styles.valueAndLabelContainer}>
          <div className={styles.value}>{value.toLocaleString()}</div>
          <div className={styles.label}>{label}</div>
        </div>
      </div>
    </div>
  );
};
