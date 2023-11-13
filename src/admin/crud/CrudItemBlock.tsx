import { PropsWithChildren, ReactElement } from 'react';
import styles from './CrudItemBlock.module.css';
import { combineClasses } from '../../shared/lib/combineClasses';

type CrudItemBlockProps = {
  /**
   * The title of the item block
   */
  title: string;

  /**
   * The controls for the item block, if there are any. This
   * is usually a fragment, in which case it will already be
   * gapped appropriately
   */
  controls: ReactElement | null;

  /**
   * A hint that this block will contain other crud item blocks, used
   * for styling
   */
  containsNested?: boolean;
};

/**
 * A simple container for a listing item within a Crud component
 */
export const CrudItemBlock = ({
  title,
  controls,
  children,
  containsNested,
}: PropsWithChildren<CrudItemBlockProps>): ReactElement => {
  return (
    <div
      className={combineClasses(
        styles.container,
        containsNested ? styles.nestableContainer : undefined
      )}>
      {(controls && (
        <div className={styles.titleAndControls}>
          <div className={styles.title}>{title}</div>
          <div className={styles.controls}>{controls}</div>
        </div>
      )) || <div className={styles.title}>{title}</div>}
      <div className={styles.content}>{children}</div>
    </div>
  );
};
