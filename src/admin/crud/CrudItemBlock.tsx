import { PropsWithChildren, ReactElement } from 'react';
import styles from './CrudItemBlock.module.css';

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
};

/**
 * A simple container for a listing item within a Crud component
 */
export const CrudItemBlock = ({
  title,
  controls,
  children,
}: PropsWithChildren<CrudItemBlockProps>): ReactElement => {
  return (
    <div className={styles.container}>
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
