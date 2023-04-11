import { PropsWithChildren, ReactElement, useEffect, useRef } from 'react';
import styles from './Button.module.css';

type ButtonProps = {
  /**
   * The type of button
   */
  type: 'button' | 'submit';

  /**
   * True for the button to fill the width of the container,
   * false for a reasonable default width
   * @default false
   */
  fullWidth?: boolean;

  /**
   * The variant of the button
   * @default 'filled'
   */
  variant?: 'filled' | 'outlined' | 'link' | 'link-small' | 'link-white' | 'link-small-upper';

  /**
   * If the button is disabled
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
};

/**
 * The standard oseh button
 */
export const Button = ({
  type,
  children,
  fullWidth = false,
  variant = 'filled',
  disabled = false,
  onClick = undefined,
  onLinkClick = undefined,
}: PropsWithChildren<ButtonProps>): ReactElement => {
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

  if (typeof onClick !== 'string') {
    return (
      <button
        type={type}
        disabled={disabled}
        onClick={onClick}
        className={`${styles.button} ${styles[variant]} ${fullWidth ? styles.fullWidth : ''}`}>
        {children}
      </button>
    );
  }

  return (
    <a
      ref={anchorRef}
      type={type}
      href={onClick}
      className={`${styles.button} ${styles[variant]} ${fullWidth ? styles.fullWidth : ''}`}>
      {children}
    </a>
  );
};
