import { Dispatch, ReactElement, SetStateAction } from 'react';
import styles from './AdminNavDesktopSideHeader.module.css';
import assistiveStyles from '../../../../shared/assistive.module.css';

type AdminNavDesktopSideHeaderProps = {
  /**
   * If the navigation is expanded
   */
  expanded: boolean;

  /**
   * A function to set the expanded state
   */
  setExpanded: Dispatch<SetStateAction<boolean>>;
};

/**
 * The admin nav side header, which contains the logo and a button to toggle
 * navigation and typically is placed at the top of the side nav.
 */
export const AdminNavDesktopSideHeader = ({
  expanded,
  setExpanded,
}: AdminNavDesktopSideHeaderProps): ReactElement => {
  return (
    <div className={styles.outerContainer}>
      <div className={`${styles.container} ${expanded ? styles.expanded : styles.collapsed}`}>
        <a href="/admin" className={styles.logoLink}>
          <div className={styles.brandmarkContainer}>
            <span className={styles.brandmark} />
          </div>
          <div className={styles.wordmarkContainer}>
            <span className={styles.wordmark} />
          </div>
          <div className={assistiveStyles.srOnly}>Oseh</div>
        </a>

        <button
          type="button"
          className={styles.toggleButton}
          onClick={() => setExpanded(!expanded)}>
          <div className={styles.toggleIconContainer}>
            <span
              className={`${styles.toggle} ${expanded ? styles.toggleClose : styles.toggleOpen}`}
            />
          </div>
          <div className={assistiveStyles.srOnly}>Toggle navigation</div>
        </button>
      </div>
    </div>
  );
};
