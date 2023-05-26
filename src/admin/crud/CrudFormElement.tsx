import { PropsWithChildren, ReactElement } from 'react';
import styles from './CrudFormElement.module.css';

type CrudFormElementProps = {
  /**
   * The title of the form element
   */
  title: string;

  /**
   * If set to true, disables the standard top margin used to
   * space elements
   */
  noTopMargin?: boolean;
};

/**
 * A very basic wrapper around a form element which doesn't have an innate
 * label. This is used to provide a consistent look and feel to form elements
 */
export const CrudFormElement = ({
  title,
  children,
  noTopMargin,
}: PropsWithChildren<CrudFormElementProps>): ReactElement => {
  return (
    <div className={styles.container} style={noTopMargin ? { marginTop: 0 } : undefined}>
      <div className={styles.title}>{title}</div>
      <div className={styles.content}>{children}</div>
    </div>
  );
};
