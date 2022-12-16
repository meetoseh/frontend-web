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
          {[...Array(3)].map((_, i) => (
            <AdminNavDesktopSideLink
              iconClass={styles.iconContent}
              text={`Example ${i + 1}`}
              url={`/admin/example${i + 1}`}
              active={currentPath === `/admin/example${i + 1}`}
              key={`top-${i}`}
            />
          ))}
          <AdminNavDesktopSideSectionHeader text="Advanced" />
          <AdminNavDesktopSideLink
            iconClass={styles.iconJourneySubcategories}
            text="Journey Categorization"
            url="/admin/journeys/subcategories"
            active={currentPath === '/admin/journeys/subcategories'}
          />
          <AdminNavDesktopSideLink
            iconClass={styles.iconDebugJourney}
            text="Debug Journey"
            url="/admin/dev_journey"
            active={currentPath === '/admin/dev_journey'}
          />
          {[...Array(2)].map((_, i) => (
            <AdminNavDesktopSideLink
              iconClass={styles.iconContent}
              text={`Example ${i + 1}`}
              url="#"
              active={false}
              key={`system-${i}`}
            />
          ))}
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
