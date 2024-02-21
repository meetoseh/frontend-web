import { PropsWithChildren, ReactElement } from 'react';
import styles from './VideoFilesChoice.module.css';

/**
 * Standard container for a series of VideoFileChoice's.
 */
export const VideoFilesChoice = ({ children }: PropsWithChildren<object>): ReactElement => {
  return <div className={styles.container}>{children}</div>;
};
