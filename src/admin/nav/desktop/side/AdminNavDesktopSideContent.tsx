import { ReactElement } from 'react';
import styles from './AdminNavDesktopSideContent.module.css';
import { AdminNavDesktopSideLink } from './AdminNavDesktopSideLink';
import { AdminNavDesktopSideSectionHeader } from './AdminNavDesktopSideSectionHeader';

type AdminNavDesktopSideContentProps = {
  expanded: boolean;
};

const currentPath = window.location.pathname;

export const AdminNavDesktopSideContent = ({
  expanded,
}: AdminNavDesktopSideContentProps): ReactElement => {
  return (
    <div className={`${styles.outerContainer} ${expanded ? styles.expanded : styles.collapsed}`}>
      <div className={styles.container}>
        <AdminNavDesktopSideLink
          iconClass={styles.iconDashboard}
          text="Dashboard"
          url="/admin"
          active={currentPath === '/admin'}
        />
        {[...Array(5)].map((_, i) => (
          <AdminNavDesktopSideLink
            iconClass={styles.iconContent}
            text={`Example ${i + 1}`}
            url="#"
            active={false}
            key={`top-${i}`}
          />
        ))}
        <AdminNavDesktopSideSectionHeader text="System" />
        {[...Array(4)].map((_, i) => (
          <AdminNavDesktopSideLink
            iconClass={styles.iconContent}
            text={`Example ${i + 1}`}
            url="#"
            active={false}
            key={`system-${i}`}
          />
        ))}
      </div>
    </div>
  );
};
