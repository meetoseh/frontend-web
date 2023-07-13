import { useCallback, useContext, useRef } from 'react';
import { useBeforeTime } from '../../../shared/hooks/useBeforeTime';
import { ModalContext, addModalWithCallbackToRemove } from '../../../shared/contexts/ModalContext';
import styles from './useUnfavoritedModal.module.css';
import { useTimedFade } from '../../../shared/hooks/usedTimedFade';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../../../shared/anim/VariableStrategyProps';
import { useValuesWithCallbacksEffect } from '../../../shared/hooks/useValuesWithCallbacksEffect';

/**
 * Shows a basic popup at the top of the screen the a message like
 * "Removed from your favorites" while the value is set and the current
 * time is before the specified time in milliseconds since the epoch.
 *
 * Requires a modal context.
 */
export const useUnfavoritedModal = (
  showUntilVariableStrategy: VariableStrategyProps<number | undefined>
) => {
  const showUntilVWC = useVariableStrategyPropsAsValueWithCallbacks(showUntilVariableStrategy);
  const modalContext = useContext(ModalContext);
  const showVWC = useBeforeTime(showUntilVariableStrategy);

  useValuesWithCallbacksEffect(
    [showUntilVWC, showVWC],
    useCallback(() => {
      const showUntil = showUntilVWC.get();
      const show = showVWC.get();
      if (!show || showUntil === undefined) {
        return;
      }

      return addModalWithCallbackToRemove(modalContext.modals, <Modal until={showUntil} />);
    }, [modalContext.modals, showUntilVWC, showVWC])
  );
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
