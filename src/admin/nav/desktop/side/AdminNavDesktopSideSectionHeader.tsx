import { ReactElement } from 'react';
import '../../../../assets/fonts.css';
import styles from './AdminNavDesktopSideSectionHeader.module.css';

type AdminNavDesktopSideSectionHeaderProps = {
  /**
   * The text which describes the section of links.
   */
  text: string;
};

/**
 * Separates a section of links within the desktop variant of the admin
 * navigation.
 */
export const AdminNavDesktopSideSectionHeader = ({
  text,
}: AdminNavDesktopSideSectionHeaderProps): ReactElement => {
  return (
    <div className={styles.container}>
      <div className={styles.text}>{text}</div>
    </div>
  );
};
