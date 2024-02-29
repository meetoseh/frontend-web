import { useCallback, useContext, useRef } from 'react';
import styles from './usePurchaseSuccessfulModal.module.css';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../../../../../shared/anim/VariableStrategyProps';
import { useBeforeTime } from '../../../../../shared/hooks/useBeforeTime';
import {
  ModalContext,
  addModalWithCallbackToRemove,
} from '../../../../../shared/contexts/ModalContext';
import { useValuesWithCallbacksEffect } from '../../../../../shared/hooks/useValuesWithCallbacksEffect';
import { useTimedFade } from '../../../../../shared/hooks/useTimedFade';
import { useValueWithCallbacksEffect } from '../../../../../shared/hooks/useValueWithCallbacksEffect';

/**
 * Shows a basic popup at the top of the screen the a message like
 * "Purchase successful!" while the value is set and the current
 * time is before the specified time in milliseconds since the epoch.
 *
 * Requires a modal context.
 */
export const usePurchaseSuccessfulModal = (
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

  const opacity = useTimedFade(until);
  useValueWithCallbacksEffect(opacity, (op) => {
    if (containerRef.current !== null) {
      containerRef.current.style.opacity = `${op * 100}%`;
    }
    return undefined;
  });

  return (
    <div
      className={styles.container}
      style={{ opacity: `${opacity.get() * 100}%` }}
      ref={containerRef}>
      <div className={styles.innerContainer}>
        <div className={styles.icon} />
        <div className={styles.text}>Checkout successful</div>
      </div>
    </div>
  );
};
