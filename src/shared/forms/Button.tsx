import { MouseEventHandler, PropsWithChildren, ReactElement } from 'react';
import styles from './Button.module.css';

type ButtonProps = {
  /**
   * The type of button
   */
  type: 'button' | 'submit';

  /**
   * The variant of the button
   * @default 'filled'
   */
  variant?: 'filled' | 'outlined';

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
  variant = 'filled',
  disabled = false,
  onClick = undefined,
}: PropsWithChildren<ButtonProps>): ReactElement => {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${styles.button} ${styles[variant]}`}>
      {children}
    </button>
  );
};
