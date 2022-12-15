import { PropsWithChildren, ReactElement } from 'react';
import styles from './CrudFiltersBlock.module.css';

/**
 * A simple container for a filter within a Crud component
 */
export const CrudFiltersBlock = ({ children }: PropsWithChildren<{}>): ReactElement => {
  return (
    <div className={styles.container}>
      <div className={styles.title}>Filter and Sort</div>
      <div className={styles.content}>{children}</div>
    </div>
  );
};
