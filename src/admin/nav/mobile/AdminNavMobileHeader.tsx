import { Dispatch, ReactElement, SetStateAction } from 'react';
import styles from './AdminNavMobileHeader.module.css';
import assistiveStyles from '../../../shared/assistive.module.css';

type AdminNavMobileHeaderProps = {
  /**
   * If the content is expanded
   */
  expanded: boolean;
  /**
   * A function to set the expanded state
   */
  setExpanded: Dispatch<SetStateAction<boolean>>;
};

/**
 * The header for the mobile navigation, which contains the logo and the hamburger menu
 */
export const AdminNavMobileHeader = ({
  expanded,
  setExpanded,
}: AdminNavMobileHeaderProps): ReactElement => {
  return (
    <div className={styles.container}>
      <div className={styles.logoContainer}>
        <a href="/admin" className={styles.logoLink}>
          <div className={styles.brandmarkContainer}>
            <span className={styles.brandmark} />
          </div>
          <div className={styles.wordmarkContainer}>
            <span className={styles.wordmark} />
          </div>
          <div className={assistiveStyles.srOnly}>Oseh</div>
        </a>
      </div>
      <div className={styles.hamburgerContainer}>
        <button
          type="button"
          className={styles.hamburgerButton}
          onClick={() => setExpanded(!expanded)}>
          <span
            className={`${styles.toggle} ${expanded ? styles.toggleClose : styles.toggleOpen}`}
          />
          <div className={assistiveStyles.srOnly}>{expanded ? 'Close' : 'Open'} navigation</div>
        </button>
      </div>
    </div>
  );
};
