import { ReactElement, useEffect, useState } from 'react';
import { LoginButton } from '../shared/LoginButton';
import { LoginProvider } from '../shared/LoginContext';
import { AdminViewContentFile } from './AdminViewContentFile';
import { AdminViewImageFile } from './AdminViewImageFile';
import { JourneyAudioContentUpload } from './JourneyAudioContentUpload';
import { JourneyBackgroundImageUpload } from './JourneyBackgroundImageUpload';
import '../assets/fonts.css';
import { AdminNavDesktopTop } from './nav/desktop/top/AdminNavDesktopTop';
import { AdminNavDesktopSideHeader } from './nav/desktop/side/AdminNavDesktopSideHeader';
import { AdminNavDesktopSideContent } from './nav/desktop/side/AdminNavDesktopSideContent';
import { AdminNavMobileHeader } from './nav/mobile/AdminNavMobileHeader';
import { AdminNavMobileContent } from './nav/mobile/AdminNavMobileContent';

export default function AdminApp(): ReactElement {
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
    <div
      style={{
        padding: '24px',
        fontFamily: 'Open Sans',
        fontSize: '16px',
        flexGrow: 1,
        background: '#F5F5F5',
        minHeight: 'calc(100vh - 80px)',
        marginTop: expanded && !isMobile ? -22 : 0,
        transition: 'margin 0.3s ease-in-out',
      }}>
      <LoginButton />
      <div>
        <a href="/admin/dev_journey">Dev Journey</a>
      </div>
      <JourneyBackgroundImageUpload />
      <JourneyAudioContentUpload />
      <AdminViewImageFile />
      <AdminViewContentFile />
    </div>
  );

  return (
    <LoginProvider>
      {(isMobile && (
        <>
          <div style={{ position: 'fixed', width: '100%' }}>
            <AdminNavMobileHeader expanded={expanded} setExpanded={setExpanded} />
            <AdminNavMobileContent expanded={expanded} />
          </div>
          <div style={{ width: '100%', height: '80px' }}></div>
        </>
      )) || (
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <AdminNavDesktopSideHeader expanded={expanded} setExpanded={setExpanded} />
          <AdminNavDesktopTop />
        </div>
      )}
      {(isMobile && content) || (
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <AdminNavDesktopSideContent expanded={expanded} />
          {content}
        </div>
      )}
    </LoginProvider>
  );
}
