import { ReactElement, useContext } from 'react';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { MyProfilePicture } from '../../../../shared/components/MyProfilePicture';
import '../../../../assets/fonts.css';
import styles from './AdminNavDesktopSideContent.module.css';
import { AdminNavDesktopSideLink } from './AdminNavDesktopSideLink';
import { AdminNavDesktopSideSectionHeader } from './AdminNavDesktopSideSectionHeader';
import { OsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';

type AdminNavDesktopSideContentProps = {
  expanded: boolean;
  imageHandler: OsehImageStateRequestHandler;
};

const currentPath = window.location.pathname;

export const AdminNavDesktopSideContent = ({
  expanded,
  imageHandler,
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
            iconClass={styles.iconUsers}
            text="Users"
            url="/admin/users"
            active={currentPath === '/admin/users'}
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
          <AdminNavDesktopSideLink
            iconClass={styles.iconVIPChatRequests}
            text="VIP Chat Requests"
            url="/admin/vip_chat_requests"
            active={currentPath === '/admin/vip_chat_requests'}
            padTextTop={4}
          />
          <AdminNavDesktopSideSectionHeader text="Visibility" />
          <AdminNavDesktopSideLink
            iconClass={styles.iconNotifications}
            text="Notifications"
            url="/admin/notifs_dashboard"
            active={currentPath === '/admin/notifs_dashboard'}
            padTextTop={6}
          />
          <AdminNavDesktopSideLink
            iconClass={styles.iconSMS}
            text="SMS"
            url="/admin/sms_dashboard"
            active={currentPath === '/admin/sms_dashboard'}
          />
          <AdminNavDesktopSideLink
            iconClass={styles.iconEmail}
            text="Email"
            url="/admin/email_dashboard"
            active={currentPath === '/admin/email_dashboard'}
          />
          <AdminNavDesktopSideLink
            iconClass={styles.iconTouch}
            text="Touch"
            url="/admin/touch_dashboard"
            active={currentPath === '/admin/touch_dashboard'}
          />
          <AdminNavDesktopSideLink
            iconClass={styles.iconReminders}
            text="Reminders"
            url="/admin/daily_reminders_dashboard"
            active={currentPath === '/admin/touch_dashboard'}
          />
        </div>
        <div className={styles.userCardContainer}>
          <MyProfilePicture imageHandler={imageHandler} />
          <div className={styles.userCardInfoContainer}>
            <div className={styles.userCardName}>{loginContext.userAttributes?.name}</div>
            <div className={styles.userCardRole}>Admin</div>
          </div>
        </div>
      </div>
    </div>
  );
};
