import { ReactElement, useContext } from 'react';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { MyProfilePicture } from '../../../../shared/components/MyProfilePicture';
import styles from './AdminNavDesktopSideContent.module.css';
import { AdminNavDesktopSideLink } from './AdminNavDesktopSideLink';
import { AdminNavDesktopSideSectionHeader } from './AdminNavDesktopSideSectionHeader';
import { OsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';

type AdminNavDesktopSideContentProps = {
  expanded: boolean;
  imageHandler: OsehImageStateRequestHandler;
};

const currentPath = window.location.pathname;

export const AdminNavDesktopSideContent = ({
  expanded,
  imageHandler,
}: AdminNavDesktopSideContentProps): ReactElement => {
  const loginContextRaw = useContext(LoginContext);

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
          <AdminNavDesktopSideLink
            iconClass={styles.iconJourneys}
            text="Series"
            url="/admin/series"
            active={currentPath === '/admin/series'}
          />
          <AdminNavDesktopSideSectionHeader text="Home" />
          <AdminNavDesktopSideLink
            iconClass={styles.iconHomeScreenImages}
            text="Home Screen Images"
            url="/admin/home_screen_images"
            active={currentPath === '/admin/home_screen_images'}
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
            iconClass={styles.iconSharing}
            text="Sharing"
            url="/admin/sharing_dashboard"
            active={currentPath === '/admin/sharing_dashboard'}
          />
          <AdminNavDesktopSideLink
            iconClass={styles.iconTouch}
            text="Touch Points"
            url="/admin/touch_points"
            active={currentPath === '/admin/touch_points'}
            padTextTop={2}
          />
          <AdminNavDesktopSideLink
            iconClass={styles.iconComputer}
            text="Client Screens"
            url="/admin/client_screens"
            active={currentPath === '/admin/client_screens'}
            padTextTop={2}
          />
          <AdminNavDesktopSideLink
            iconClass={styles.iconWorkflowCircle}
            text="Client Flows"
            url="/admin/client_flows"
            active={currentPath === '/admin/client_flows'}
            padTextTop={2}
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
            padTextTop={2}
          />
          <AdminNavDesktopSideLink
            iconClass={styles.iconReminders}
            text="Reminders"
            url="/admin/daily_reminders_dashboard"
            active={currentPath === '/admin/daily_reminders_dashboard'}
          />
          <AdminNavDesktopSideLink
            iconClass={styles.iconSignInWithOseh}
            text="Sign in with Oseh"
            url="/admin/sign_in_with_oseh_dashboard"
            active={currentPath === '/admin/sign_in_with_oseh_dashboard'}
          />
          <AdminNavDesktopSideLink
            iconClass={styles.iconChart}
            text="Screens"
            url="/admin/screens_dashboard"
            active={currentPath === '/admin/screens_dashboard'}
            padTextTop={2}
          />
          <AdminNavDesktopSideLink
            iconClass={styles.iconOnboardingVideos}
            text="Onboarding Videos"
            url="/admin/onboarding_videos"
            active={currentPath === '/admin/onboarding_videos'}
          />
          <AdminNavDesktopSideSectionHeader text="Misc" />
          <AdminNavDesktopSideLink
            iconClass={styles.iconFlowChartExamples}
            text="Flow Chart Examples"
            url="/admin/flow_chart_examples"
            active={currentPath === '/admin/flow_chart_examples'}
          />
          <AdminNavDesktopSideLink
            iconClass={styles.iconDebugJourney}
            text="Debug Voice Notes"
            url="/admin/debug_voice_note_upload"
            active={currentPath === '/admin/debug_voice_note_upload'}
          />
        </div>
        <div className={styles.userCardContainer}>
          <MyProfilePicture imageHandler={imageHandler} />
          <div className={styles.userCardInfoContainer}>
            <div className={styles.userCardName}>
              <RenderGuardedComponent
                props={loginContextRaw.value}
                component={(loginContext) => {
                  if (loginContext.state === 'logged-in') {
                    return <>{loginContext.userAttributes?.name}</>;
                  }
                  return <></>;
                }}
              />
            </div>
            <div className={styles.userCardRole}>Admin</div>
          </div>
        </div>
      </div>
    </div>
  );
};
