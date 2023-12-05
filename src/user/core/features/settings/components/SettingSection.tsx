import { PropsWithChildren, ReactElement } from 'react';
import styles from './SettingSection.module.css';

export type SettingSectionProps = {
  /**
   * The title for the section. May be omitted for no title,
   * sometimes using only a subtitle instead for reduced emphasis
   */
  title?: string;

  /**
   * The subtitle for the section, or, if the title is omitted,
   * the title but with reduced emphasis
   */
  subtitle?: string;

  /**
   * If specified, the class name for the container of the children
   */
  contentClassName?: string;
};

/**
 * Renders a section, typically used within the main settings admin area,
 * with an optional title and optional subtitle. This component is tight,
 * i.e., there are no outer margins or padding. It fills the width of the
 * parent and flows vertically.
 */
export const SettingSection = ({
  title,
  subtitle,
  contentClassName,
  children,
}: PropsWithChildren<SettingSectionProps>): ReactElement => {
  return (
    <div className={styles.container}>
      {title && <div className={styles.title}>{title}</div>}
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      <div className={contentClassName}>{children}</div>
    </div>
  );
};
