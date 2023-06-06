import { useContext, useEffect, useRef } from 'react';
import { useBeforeTime } from '../../../shared/hooks/useBeforeTime';
import { ModalContext, addModalWithCallbackToRemove } from '../../../shared/ModalContext';
import styles from './useUnfavoritedModal.module.css';
import { useTimedFade } from '../../../shared/hooks/usedTimedFade';

/**
 * Shows a basic popup at the top of the screen the a message like
 * "Removed from your favorites" while the value is set and the current
 * time is before the specified time in milliseconds since the epoch.
 *
 * Requires a modal context.
 */
export const useUnfavoritedModal = (showUntil?: number) => {
  const modalContext = useContext(ModalContext);
  const show = useBeforeTime(showUntil);

  useEffect(() => {
    if (!show || showUntil === undefined) {
      return;
    }

    return addModalWithCallbackToRemove(modalContext.setModals, <Modal until={showUntil} />);
  }, [modalContext.setModals, show, showUntil]);
};

const Modal = ({ until }: { until: number }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useTimedFade(containerRef, until);

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.innerContainer}>
        <div className={styles.icon} />
        <div className={styles.text}>Removed from your favorites</div>
      </div>
    </div>
  );
};
