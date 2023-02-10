import { ReactElement, useContext } from 'react';
import { LoginContext } from '../../../../shared/LoginContext';
import { MyProfilePicture } from '../../../../shared/MyProfilePicture';
import '../../../../assets/fonts.css';
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
  const loginContext = useContext(LoginContext);

  return (
    <div className={`${styles.outerContainer} ${expanded ? styles.expanded : styles.collapsed}`}>
      <div className={styles.container}>
        <div className={styles.linksContainer}>
          <AdminNavDesktopSideLink
            iconClass={styles.iconDashboard}
            text="Dashboard"
            url="/admin"
            active={currentPath === '/admin'}
          />
          <AdminNavDesktopSideLink
            iconClass={styles.iconInstructors}
            text="Instructors"
            url="/admin/instructors"
            active={currentPath === '/admin/instructors'}
          />
          <AdminNavDesktopSideLink
            iconClass={styles.iconJourneys}
            text="Journeys"
            url="/admin/journeys"
            active={currentPath === '/admin/journeys'}
          />
          <AdminNavDesktopSideLink
            iconClass={styles.iconDailyEvents}
            text="Calendar"
            url="/admin/daily_events"
            active={currentPath === '/admin/daily_events'}
          />
          <AdminNavDesktopSideSectionHeader text="Advanced" />
          <AdminNavDesktopSideLink
            iconClass={styles.iconJourneySubcategories}
            text="Journey Categorization"
            url="/admin/journeys/subcategories"
            active={currentPath === '/admin/journeys/subcategories'}
          />
          <AdminNavDesktopSideLink
            iconClass={styles.iconIntroductoryJourneys}
            text="Introductory Journeys"
            url="/admin/journeys/intro"
            active={currentPath === '/admin/journeys/intro'}
          />
        </div>
        <div className={styles.userCardContainer}>
          <MyProfilePicture />
          <div className={styles.userCardInfoContainer}>
            <div className={styles.userCardName}>{loginContext.userAttributes?.name}</div>
            <div className={styles.userCardRole}>Admin</div>
          </div>
        </div>
      </div>
    </div>
  );
};
