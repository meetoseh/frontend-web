import { ReactElement, useEffect, useState } from 'react';
import { LoginProvider } from '../shared/LoginContext';
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

export const AdminRoutes = (): ReactElement => {
  return (
    <>
      <Route path="dev_journey" element={<DevJourneyApp />} />
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
        <div className={`${styles.container} ${expanded ? styles.expanded : styles.collapsed}`}>
          {(isMobile && (
            <>
              <div className={styles.mobileHeaderContainer}>
                <AdminNavMobileHeader expanded={expanded} setExpanded={setExpanded} />
                <AdminNavMobileContent expanded={expanded} />
              </div>
              <div className={styles.mobileHeaderPadding}></div>
            </>
          )) || (
            <div className={styles.desktopTopContainer}>
              <AdminNavDesktopSideHeader expanded={expanded} setExpanded={setExpanded} />
              <AdminNavDesktopTop />
            </div>
          )}
          {(isMobile && content) || (
            <div className={styles.desktopSideAndContentContainer}>
              <AdminNavDesktopSideContent expanded={expanded} />
              {content}
            </div>
          )}
        </div>
      </RequireLoggedIn>
    </LoginProvider>
  );
};
