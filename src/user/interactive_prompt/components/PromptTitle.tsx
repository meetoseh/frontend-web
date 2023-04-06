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

  /**
   * If specified, used to configure the max width of the title in pixels.
   * It's often useful to configure this if the prompt title is known in
   * advance to get an aesthetically pleasing layout.
   */
  titleMaxWidth?: number;
};

export const PromptTitle = ({ text, subtitle, titleMaxWidth }: PromptTitleProps): ReactElement => {
  return (
    <div className={styles.container}>
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      <div
        className={styles.title}
        style={titleMaxWidth === undefined ? undefined : { maxWidth: `${titleMaxWidth}px` }}>
        {text}
      </div>
    </div>
  );
};
