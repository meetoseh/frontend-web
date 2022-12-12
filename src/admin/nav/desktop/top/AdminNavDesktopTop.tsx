import { ReactElement } from 'react';
import styles from './AdminNavDesktopTop.module.css';
import { AdminNavDesktopTopSearch } from './AdminNavDesktopTopSearch';
import { AdminNavDesktopUserSettings } from './AdminNavDesktopUserSettings';

export const AdminNavDesktopTop = (): ReactElement => {
  return (
    <div className={styles.container}>
      <AdminNavDesktopTopSearch />
      <AdminNavDesktopUserSettings />
    </div>
  );
};
