import { MouseEventHandler, ReactElement } from 'react';
import styles from './IconButton.module.css';
import assistiveStyles from '../assistive.module.css';

type IconButtonProps = {
  /**
   * The class which, when applied to an element, renders the icon
   */
  icon: string;

  /**
   * The name for screen readers
   */
  srOnlyName: string;

  /**
   * The click handler, or a string to use an anchor tag instead
   */
  onClick: MouseEventHandler<HTMLButtonElement> | string;

  /**
   * If the button should be disabled
   * @default false
   */
  disabled?: boolean;
};

export const IconButton = ({
  icon,
  srOnlyName,
  onClick,
  disabled = false,
}: IconButtonProps): ReactElement => {
  if (typeof onClick === 'string') {
    return (
      <a href={onClick} className={styles.button}>
        <div className={icon} aria-hidden="true" />
        <span className={assistiveStyles.srOnly}>{srOnlyName}</span>
      </a>
    );
  } else {
    return (
      <button type="button" onClick={onClick} className={styles.button} disabled={disabled}>
        <div className={icon} aria-hidden="true" />
        <span className={assistiveStyles.srOnly}>{srOnlyName}</span>
      </button>
    );
  }
};
