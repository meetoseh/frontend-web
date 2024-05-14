import { ReactElement, useEffect, useState } from 'react';
import { LoginProvider } from '../shared/contexts/LoginContext';
import { AdminNavDesktopTop } from './nav/desktop/top/AdminNavDesktopTop';
import { AdminNavDesktopSideHeader } from './nav/desktop/side/AdminNavDesktopSideHeader';
import { AdminNavDesktopSideContent } from './nav/desktop/side/AdminNavDesktopSideContent';
import { AdminNavMobileHeader } from './nav/mobile/AdminNavMobileHeader';
import { AdminNavMobileContent } from './nav/mobile/AdminNavMobileContent';
import { RequireLoggedIn } from './RequireLoggedIn';
import { Outlet, Route } from 'react-router-dom';
import { AdminDashboard } from './dashboard/AdminDashboard';
import styles from './AdminApp.module.css';
import DevJourneyApp from './dev_journey/DevJourneyApp';
import { Instructors } from './instructors/Instructors';
import { Journeys } from './journeys/Journeys';
import { JourneySubcategories } from './journeys/subcategories/JourneySubcategories';
import { ModalProvider } from '../shared/contexts/ModalContext';
import { IntroductoryJourneys } from './journeys/intros/IntroductoryJourneys';
import { VipChatRequests } from './vip_chat_requests/VipChatRequests';
import { Users } from './users/Users';
import { BigUser } from './users/big/BigUser';
import { useOsehImageStateRequestHandler } from '../shared/images/useOsehImageStateRequestHandler';
import { AdminNotifsDashboard } from './notifs_dashboard/AdminNotifsDashboard';
import { useFonts } from '../shared/lib/useFonts';
import { SplashScreen } from '../user/splash/SplashScreen';
import { AdminSMSDashboard } from './sms_dashboard/AdminSMSDashboard';
import { AdminEmailDashboard } from './email_dashboard/AdminEmailDashboard';
import { AdminTouchDashboard } from './touch_dashboard/AdminTouchDashboard';
import { AdminDailyRemindersDashboard } from './daily_reminders_dashboard/AdminDailyRemindersDashboard';
import { AdminSignInWithOsehDashboard } from './sign_in_with_oseh_dashboard/AdminSignInWithOsehDashboard';
import { AdminSharingDashboard } from './sharing_dashboard/SharingDashboard';
import { FlowChartExamples } from './flow_chart_examples/FlowChartExamples';
import { Courses } from './courses/Courses';
import { HomeScreenImages } from './home_screen_images/HomeScreenImages';
import { OnboardingVideos } from './onboarding_videos/OnboardingVideos';
import { TouchPoints } from './touch_points/TouchPoints';
import { BigTouchPoint } from './touch_points/BigTouchPoint';
import { ClientScreens } from './client_screens/ClientScreens';
import { BigClientScreen } from './client_screens/BigClientScreen';
import { ClientFlows } from './client_flows/ClientFlows';
import { BigClientFlow } from './client_flows/BigClientFlow';

export const AdminRoutes = (): ReactElement => {
  return (
    <>
      <Route path="dev_journey" element={<DevJourneyApp />} />
      <Route path="instructors" element={<Instructors />} />
      <Route path="journeys" element={<Journeys />} />
      <Route path="journeys/subcategories" element={<JourneySubcategories />} />
      <Route path="journeys/intro" element={<IntroductoryJourneys />} />
      <Route path="users" element={<Users />} />
      <Route path="user" element={<BigUser />} />
      <Route path="vip_chat_requests" element={<VipChatRequests />} />
      <Route path="sharing_dashboard" element={<AdminSharingDashboard />} />
      <Route path="notifs_dashboard" element={<AdminNotifsDashboard />} />
      <Route path="sms_dashboard" element={<AdminSMSDashboard />} />
      <Route path="email_dashboard" element={<AdminEmailDashboard />} />
      <Route path="touch_dashboard" element={<AdminTouchDashboard />} />
      <Route path="daily_reminders_dashboard" element={<AdminDailyRemindersDashboard />} />
      <Route path="sign_in_with_oseh_dashboard" element={<AdminSignInWithOsehDashboard />} />
      <Route path="flow_chart_examples" element={<FlowChartExamples />} />
      <Route path="series" element={<Courses />} />
      <Route path="home_screen_images" element={<HomeScreenImages />} />
      <Route path="onboarding_videos" element={<OnboardingVideos />} />
      <Route path="touch_points" element={<TouchPoints />} />
      <Route path="touch_point" element={<BigTouchPoint />} />
      <Route path="client_screens" element={<ClientScreens />} />
      <Route path="client_screen" element={<BigClientScreen />} />
      <Route path="client_flows" element={<ClientFlows />} />
      <Route path="client_flow" element={<BigClientFlow />} />
      <Route path="example1" element={<div>EXAMPLE 1</div>} />
      <Route path="" element={<AdminDashboard />} />
      <Route path="*" element={<div>CATCHALL</div>} />
    </>
  );
};

const requiredFonts = [
  '300 1em Open Sans',
  '400 1em Open Sans',
  'italic 400 1em Open Sans',
  '600 1em Open Sans',
  '700 1em Open Sans',
];

export const AdminApp = (): ReactElement => {
  const [expanded, setExpanded] = useState(window.innerWidth >= 992);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);
  const fontsLoaded = useFonts(requiredFonts);
  const imageHandler = useOsehImageStateRequestHandler({});

  useEffect(() => {
    let active = true;
    let closeHandlers: (() => void)[] = [];
    listenForResize();
    return () => {
      active = false;
      closeHandlers.forEach((handler) => handler());
    };

    function listenForResize() {
      let timeout: NodeJS.Timeout | null = null;

      const update = () => {
        if (!active) {
          return;
        }
        timeout = null;
        setIsMobile(window.innerWidth < 992);
      };

      const handler = () => {
        if (timeout) {
          clearTimeout(timeout);
        }
        timeout = setTimeout(update, 100);
      };

      window.addEventListener('resize', handler);
      closeHandlers.push(() => window.removeEventListener('resize', handler));
    }
  }, []);

  const content = (
    <div className={styles.outletContainer}>
      <Outlet />
    </div>
  );

  if (!fontsLoaded) {
    return <SplashScreen />;
  }

  return (
    <LoginProvider>
      <RequireLoggedIn>
        <ModalProvider>
          <div className={`${styles.container} ${expanded ? styles.expanded : styles.collapsed}`}>
            {isMobile ? (
              <div className={styles.mobileHeaderPadding}></div>
            ) : (
              <>
                <div className={styles.desktopSideContainer}>
                  <div className={styles.desktopSideHeaderPadding}></div>
                  <AdminNavDesktopSideContent expanded={expanded} imageHandler={imageHandler} />
                </div>
              </>
            )}
            {(isMobile && content) || (
              <div className={styles.desktopContentContainer}>{content}</div>
            )}
            {!isMobile ? (
              <>
                <div className={styles.desktopSideHeaderContainer}>
                  <AdminNavDesktopSideHeader expanded={expanded} setExpanded={setExpanded} />
                </div>
                <div className={styles.desktopTopContainer}>
                  <AdminNavDesktopTop imageHandler={imageHandler} />
                </div>
              </>
            ) : (
              <>
                <div className={styles.mobileHeaderContainer}>
                  <AdminNavMobileHeader expanded={expanded} setExpanded={setExpanded} />
                  <AdminNavMobileContent expanded={expanded} />
                </div>
              </>
            )}
          </div>
        </ModalProvider>
      </RequireLoggedIn>
    </LoginProvider>
  );
};
