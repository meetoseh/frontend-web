import { ReactElement } from 'react';
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

  /**
   * Additional padding applied to the top of the text, moving it down. To
   * keep the spacing between the texts the same, this also shifts the whole
   * link up by the appropriate amount.
   */
  padTextTop?: number;
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
  padTextTop,
}: AdminNavDesktopSideLinkProps): ReactElement => {
  return (
    <div
      className={`${styles.container} ${active ? styles.active : styles.inactive}`}
      style={padTextTop === undefined ? undefined : { marginTop: `${-padTextTop / 2}px` }}>
      <a className={styles.link} href={url}>
        <div>
          <i className={iconClass} />
        </div>
        <div
          className={styles.text}
          style={padTextTop === undefined ? undefined : { paddingTop: `${padTextTop}px` }}>
          {text}
        </div>
      </a>
    </div>
  );
};
