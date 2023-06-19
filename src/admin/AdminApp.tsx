import { ReactElement, useEffect, useState } from 'react';
import { LoginProvider } from '../shared/contexts/LoginContext';
import '../assets/fonts.css';
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
      <Route path="example1" element={<div>EXAMPLE 1</div>} />
      <Route path="" element={<AdminDashboard />} />
      <Route path="*" element={<div>CATCHALL</div>} />
    </>
  );
};

export const AdminApp = (): ReactElement => {
  const [expanded, setExpanded] = useState(window.innerWidth >= 992);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);

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
                  <AdminNavDesktopSideContent expanded={expanded} />
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
                  <AdminNavDesktopTop />
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
