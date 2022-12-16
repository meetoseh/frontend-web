import { PropsWithChildren, ReactElement } from 'react';
import styles from './modals.module.css';

type ModalProps = {
  /**
   * Called when the user clicks outside the modal
   */
  onClosed: () => void;
};

/**
 * Wraps the children in the standard modal wrapper. This is typically used
 * when injecting into the modal context.
 */
export const ModalWrapper = ({
  children,
  onClosed,
}: PropsWithChildren<ModalProps>): ReactElement => {
  return (
    <div
      className={styles.container}
      onClick={(e) => {
        e.stopPropagation();
        onClosed();
      }}>
      <div
        className={styles.innerContainer}
        onClick={(e) => {
          e.stopPropagation();
        }}>
        {children}
      </div>
    </div>
  );
};
