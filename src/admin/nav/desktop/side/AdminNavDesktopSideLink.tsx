import { ReactElement } from 'react';
import '../../../../assets/fonts.css';
import styles from './AdminNavDesktopSideLink.module.css';

type AdminNavDesktopSideLinkProps = {
  /**
   * The class name to attach to the icon container, which will style
   * the contained `.icon` element.
   */
  iconClass: string;

  /**
   * The text which describes where the link will take the user.
   */
  text: string;

  /**
   * The URL to which the link will take the user.
   */
  url: string;

  /**
   * Whether or not the user is already on this page, which will
   * change the styling of the link.
   */
  active: boolean;
};

/**
 * Describes a link within the desktop variant of the admin navigation,
 * which consists of an icon and text.
 */
export const AdminNavDesktopSideLink = ({
  iconClass,
  text,
  url,
  active,
}: AdminNavDesktopSideLinkProps): ReactElement => {
  return (
    <div className={`${styles.container} ${active ? styles.active : styles.inactive}`}>
      <a className={styles.link} href={url}>
        <div>
          <i className={iconClass} />
        </div>
        <div className={styles.text}>{text}</div>
      </a>
    </div>
  );
};
