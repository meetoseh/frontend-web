import { ReactElement } from 'react';
import styles from './PromptTitle.module.css';

type PromptTitleProps = {
  /**
   * The text of the prompt
   */
  text: string;

  /**
   * If specified, a subtitle is shown just about the prompt text,
   * e.g., 'Class Poll'
   */
  subtitle?: string;
};

export const PromptTitle = ({ text, subtitle }: PromptTitleProps): ReactElement => {
  return (
    <div className={styles.container}>
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      <div className={styles.title}>{text}</div>
    </div>
  );
};
