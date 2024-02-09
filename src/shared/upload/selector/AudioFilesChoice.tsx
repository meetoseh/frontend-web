import { PropsWithChildren, ReactElement } from 'react';
import styles from './AudioFilesChoice.module.css';

/**
 * Standard container for a series of AudioFileChoice's.
 */
export const AudioFilesChoice = ({ children }: PropsWithChildren<object>): ReactElement => {
  return <div className={styles.container}>{children}</div>;
};
