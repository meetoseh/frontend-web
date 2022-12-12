import { ReactElement } from 'react';
import styles from './AdminNavMobileContent.module.css';
import { AdminNavMobileLink } from './AdminNavMobileLink';

type AdminNavMobileContentProps = {
  /**
   * If the content is expanded
   */
  expanded: boolean;
};

/**
 * The content for the mobile navigation, which contains the links
 */
export const AdminNavMobileContent = ({ expanded }: AdminNavMobileContentProps): ReactElement => {
  return (
    <div className={`${styles.container} ${expanded ? styles.expanded : styles.collapsed}`}>
      <div className={styles.content}>
        <AdminNavMobileLink text="Dashboard" url="/admin" />
        {[...Array(5)].map((_, i) => (
          <AdminNavMobileLink key={i.toString()} text={`Example ${i + 1}`} url="#" />
        ))}
      </div>
    </div>
  );
};
