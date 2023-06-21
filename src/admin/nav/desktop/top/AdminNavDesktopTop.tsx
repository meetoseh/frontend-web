import { ReactElement, useEffect, useState } from 'react';
import styles from './AdminNavDesktopTop.module.css';
import { AdminNavDesktopTopSearch } from './AdminNavDesktopTopSearch';
import { AdminNavDesktopUserSettings } from './AdminNavDesktopUserSettings';
import { OsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';

export const AdminNavDesktopTop = ({
  imageHandler,
}: {
  imageHandler: OsehImageStateRequestHandler;
}): ReactElement => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    const doAdjust = () => {
      setScrolled(window.scrollY > 0);
    };

    const handler = () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(doAdjust, 300);
    };
    doAdjust();
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className={`${styles.container} ${scrolled ? styles.scrolled : ''}`}>
      <AdminNavDesktopTopSearch />
      <AdminNavDesktopUserSettings imageHandler={imageHandler} />
    </div>
  );
};
