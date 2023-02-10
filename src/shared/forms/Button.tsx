import { MouseEventHandler, PropsWithChildren, ReactElement } from 'react';
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
  variant?: 'filled' | 'outlined' | 'link' | 'link-small' | 'link-white';

  /**
   * If the button is disabled
   */
  disabled?: boolean;

  /**
   * Called when the button is clicked
   */
  onClick?: MouseEventHandler<HTMLButtonElement> | undefined;
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
}: PropsWithChildren<ButtonProps>): ReactElement => {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${styles.button} ${styles[variant]} ${fullWidth ? styles.fullWidth : ''}`}>
      {children}
    </button>
  );
};
