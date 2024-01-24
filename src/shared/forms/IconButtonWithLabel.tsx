import { ReactElement, useEffect, useRef } from 'react';
import { InlineOsehSpinner } from '../components/InlineOsehSpinner';
import styles from './IconButtonWithLabel.module.css';

export type IconButtonWithLabelProps = {
  /**
   * The icon to display, as a class name that can be applied to a div
   */
  iconClass: string;

  /**
   * The label to display
   */
  label: string;

  /**
   * If the button is disabled, ignored for anchor elements
   */
  disabled?: boolean;

  /**
   * Called when the button is clicked. Can be a string to be treated as a url
   */
  onClick?: React.MouseEventHandler<HTMLButtonElement> | string | undefined;

  /**
   * Ignored unless onClick is a string. Called when the link is clicked,
   * when the user is already being navigated to the link
   */
  onLinkClick?: ((this: HTMLAnchorElement, ev: MouseEvent) => void) | undefined;

  /**
   * If true, a spinner is displayed instead of the icon
   */
  spinner?: boolean;
};

export const IconButtonWithLabel = ({
  iconClass,
  label,
  disabled,
  onClick,
  onLinkClick,
  spinner,
}: IconButtonWithLabelProps): ReactElement => {
  const anchorRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (
      anchorRef.current === null ||
      anchorRef.current === undefined ||
      onLinkClick === undefined
    ) {
      return;
    }
    const anchor = anchorRef.current;
    anchor.addEventListener('click', onLinkClick, false);
    return () => {
      anchor.removeEventListener('click', onLinkClick, false);
    };
  }, [onLinkClick]);

  const contents = (
    <>
      <div className={styles.iconContainer}>
        {spinner ? (
          <InlineOsehSpinner
            size={{
              type: 'react-rerender',
              props: {
                width: 20,
              },
            }}
          />
        ) : (
          <div className={iconClass} />
        )}
      </div>
      <div className={styles.label}>{label}</div>
    </>
  );

  if (onClick === undefined || typeof onClick === 'function') {
    return (
      <button type="button" className={styles.button} onClick={onClick} disabled={disabled}>
        {contents}
      </button>
    );
  }

  return (
    <a href={onClick} className={styles.button} ref={anchorRef}>
      {contents}
    </a>
  );
};
