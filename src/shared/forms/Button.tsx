import { MouseEventHandler, PropsWithChildren, ReactElement } from 'react';
import styles from './Button.module.css';

type ButtonProps = {
  /**
   * If the button is disabled
   */
  disabled: boolean;

  /**
   * The type of button
   */
  type: 'button' | 'submit';

  /**
   * Called when the button is clicked
   */
  onClick: MouseEventHandler<HTMLButtonElement>;
};

/**
 * The standard oseh button
 */
export const Button = ({
  disabled,
  type,
  onClick,
  children,
}: PropsWithChildren<ButtonProps>): ReactElement => {
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={styles.button}>
      {children}
    </button>
  );
};
