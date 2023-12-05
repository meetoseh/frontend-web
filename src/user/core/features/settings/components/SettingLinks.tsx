import { ReactElement, useEffect, useRef } from 'react';
import { InlineOsehSpinner } from '../../../../../shared/components/InlineOsehSpinner';
import { RenderGuardedComponent } from '../../../../../shared/components/RenderGuardedComponent';
import {
  ValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { combineClasses } from '../../../../../shared/lib/combineClasses';
import { setVWC } from '../../../../../shared/lib/setVWC';
import styles from './SettingLinks.module.css';

/**
 * Describes a link that can be used within a settings link block
 */
export type SettingLink = {
  /**
   * The text to display for the link
   */
  text: string;

  /**
   * If specified, displayed below the text in a smaller font, with
   * a newline between each entry
   */
  details?: string[];

  /**
   * The key for the link for rerendering purposes.
   *
   * TODO: Currently ignored for simplicity of implementation with the
   * exception that if this key changes the component will be rerendered.
   * If performance becomes an issue, this can be used to optimize rerendering
   */
  key: string;

  /**
   * The text style for the link, where normal is standard white
   * text
   */
  style?: 'normal';

  /**
   * Which icon to display on the right side of the link, if any,
   * when the spinner is not displayed.
   *
   * Defaults to 'arrow'
   */
  action?: 'arrow' | 'none';

  /**
   * If clicking the link should redirect the user to a new page,
   * i.e., it should be implemented with an anchor tag, this is the
   * URL to redirect to. Otherwise, if this is a function, it will
   * be called when the link is clicked.
   *
   * While the promise is running the link will be disabled and an animation may
   * play to indicate that the user should wait. undefined can be returned to
   * enforce that no animation is played.
   */
  onClick: string | (() => Promise<void> | undefined);

  /**
   * If onClick is a string, this may be a function that will be called before
   * the user is redirected. It may be interrupted at any point, and is typically
   * used to send beacons
   */
  onLinkClick?: () => void;

  /**
   * If true, the link will be disabled. If false, the link will not be disabled
   * even if onClick is a function returning a promise that's still running.
   * If undefined, the link is disabled while the promise is running.
   *
   * Ignored if onClick is a string.
   */
  disabled?: boolean;

  /**
   * If true, a spinner will be presented. If false, a spinner will not be
   * presented even if onClick is a function returning a promise that's still
   * running. If undefined, a spinner is presented while the promise is running.
   *
   * Ignored if onClick is a string.
   */
  spinner?: boolean;
};

export type SettingLinksProps = {
  /**
   * The links to display; null entries are skipped
   */
  links: ValueWithCallbacks<SettingLink | null>[];
};

/**
 * A block of links that can be used in a settings page
 */
export const SettingsLinks = ({ links }: SettingLinksProps): ReactElement => {
  return (
    <div className={styles.container}>
      {links.map((link, index) => {
        return (
          <RenderGuardedComponent
            props={link}
            key={index}
            component={(link) => (
              <>{link !== null && <SettingLinkComponent key={link.key} link={link} />}</>
            )}
          />
        );
      })}
    </div>
  );
};

const SettingLinkComponent = ({ link }: { link: SettingLink }): ReactElement => {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const runningVWC = useWritableValueWithCallbacks(() => false);

  useEffect(() => {
    if (typeof link.onClick !== 'string') {
      return;
    }
    if (link.onLinkClick === undefined) {
      return;
    }
    if (linkRef.current === null) {
      return;
    }

    const clickHandler = link.onLinkClick;
    const anchor = linkRef.current;
    anchor.addEventListener('click', clickHandler, false);
    return () => {
      anchor.removeEventListener('click', clickHandler, false);
    };
  }, [link.onClick, link.onLinkClick]);

  if (link === null) {
    return <></>;
  }

  if (typeof link.onClick === 'string') {
    const linkStyle = link.style || 'normal';
    return (
      <a
        href={link.onClick}
        className={combineClasses(styles.item, styles.itemLink, styles[`item-${linkStyle}`])}
        ref={linkRef}>
        <div className={styles.content}>
          <div className={combineClasses(styles.text, styles[`text-${linkStyle}`])}>
            {link.text}
          </div>
          {link.details !== undefined && (
            <div className={styles.details}>
              {link.details.map((detail, index) => (
                <div key={index} className={styles.detail}>
                  {detail}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={styles.actionContainer}>
          {(link.action === 'arrow' || link.action === undefined) && (
            <div className={styles.arrow} />
          )}
        </div>
      </a>
    );
  }

  return (
    <RenderGuardedComponent
      props={runningVWC}
      component={(running) => {
        const isDisabled = link.disabled || (link.disabled === undefined && running);
        const isSpinner = link.spinner || (link.spinner === undefined && running);
        const linkStyle = link.style || 'normal';
        return (
          <button
            className={combineClasses(
              styles.item,
              styles.itemButton,
              isDisabled ? styles.itemDisabled : undefined,
              isSpinner ? styles.itemSpinner : undefined,
              styles[`item-${linkStyle}`]
            )}
            onClick={async (e) => {
              e.preventDefault();

              if (isDisabled) {
                return;
              }

              setVWC(runningVWC, true);
              try {
                const handler = link.onClick;
                if (typeof handler === 'function') {
                  await handler();
                }
              } finally {
                setVWC(runningVWC, false);
              }
            }}
            disabled={isDisabled}>
            <div className={styles.content}>
              <div className={combineClasses(styles.text, styles[`text-${linkStyle}`])}>
                {link.text}
              </div>
              {link.details !== undefined && (
                <div className={styles.details}>
                  {link.details.map((detail, index) => (
                    <div key={index} className={styles.detail}>
                      {detail}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.actionContainer}>
              {isSpinner && (
                <InlineOsehSpinner
                  size={{
                    type: 'react-rerender',
                    props: {
                      height: 16,
                    },
                  }}
                />
              )}
              {!isSpinner && (link.action === undefined || link.action === 'arrow') && (
                <div className={styles.arrow} />
              )}
            </div>
          </button>
        );
      }}
    />
  );
};
