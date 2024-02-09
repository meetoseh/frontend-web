import { PropsWithChildren, ReactElement } from 'react';
import styles from './ImageFilesChoice.module.css';

/**
 * Standard container for a series of ImageFileChoice's.
 */
export const ImageFilesChoice = ({ children }: PropsWithChildren<object>): ReactElement => {
  return <div className={styles.container}>{children}</div>;
};
