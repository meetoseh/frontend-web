import { ReactElement } from 'react';
import styles from './AdminNavMobileLink.module.css';

type AdminNavMobileLinkProps = {
  /**
   * The text of the link
   */
  text: string;

  /**
   * The url of the link
   */
  url: string;
};

export const AdminNavMobileLink = ({ text, url }: AdminNavMobileLinkProps): ReactElement => {
  return (
    <div className={styles.container}>
      <a className={styles.link} href={url}>
        {text}
      </a>
    </div>
  );
};
