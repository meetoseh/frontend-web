import { PropsWithChildren, ReactElement } from 'react';
import styles from './CrudCreateBlock.module.css';

/**
 * A simple container for a create form within a Crud component
 */
export const CrudCreateBlock = ({ children }: PropsWithChildren<{}>): ReactElement => {
  return (
    <div className={styles.container}>
      <div className={styles.title}>Create</div>
      <div className={styles.content}>{children}</div>
    </div>
  );
};
