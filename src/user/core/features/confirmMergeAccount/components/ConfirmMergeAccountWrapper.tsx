import { PropsWithChildren, ReactElement, useCallback, useEffect, useRef } from 'react';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { ConfirmMergeAccountState } from '../ConfirmMergeAccountState';
import { useWindowSizeValueWithCallbacks } from '../../../../../shared/hooks/useWindowSize';
import { useFullHeight } from '../../../../../shared/hooks/useFullHeight';
import styles from './styles.module.css';
import { ConfirmMergeAccountResources } from '../ConfirmMergeAccountResources';
import { useValueWithCallbacksEffect } from '../../../../../shared/hooks/useValueWithCallbacksEffect';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { IconButton } from '../../../../../shared/forms/IconButton';
import { useTimedValueWithCallbacks } from '../../../../../shared/hooks/useTimedValue';
import { useMappedValuesWithCallbacks } from '../../../../../shared/hooks/useMappedValuesWithCallbacks';

export const ConfirmMergeAccountWrapper = ({
  state,
  resources,
  closeDisabled,
  onDismiss,
  children,
}: PropsWithChildren<{
  state: ValueWithCallbacks<ConfirmMergeAccountState>;
  resources: ValueWithCallbacks<ConfirmMergeAccountResources>;
  closeDisabled?: WritableValueWithCallbacks<boolean>;
  onDismiss?: WritableValueWithCallbacks<() => void>;
}>): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);
  const windowSize = useWindowSizeValueWithCallbacks();
  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSizeVWC: windowSize });

  const accidentalClickThroughPrevention = useTimedValueWithCallbacks(true, false, 2000);

  const rawCloseDisabled = useMappedValuesWithCallbacks(
    [state, accidentalClickThroughPrevention],
    () =>
      state.get().result === undefined ||
      state.get().confirmResult === undefined ||
      accidentalClickThroughPrevention.get()
  );

  const realCloseDisabled = useWritableValueWithCallbacks(() => false);
  useValueWithCallbacksEffect(rawCloseDisabled, (v) => {
    if (!v) {
      setVWC(realCloseDisabled, false);
      return undefined;
    }

    setVWC(realCloseDisabled, true);
    let timeout: NodeJS.Timeout | null = setTimeout(() => {
      timeout = null;
      setVWC(realCloseDisabled, false);
    }, 5000);

    return () => {
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    };
  });

  useEffect(() => {
    if (closeDisabled === undefined) {
      return;
    }

    realCloseDisabled.callbacks.add(copyValue);
    copyValue();
    return () => {
      realCloseDisabled.callbacks.remove(copyValue);
    };

    function copyValue() {
      if (closeDisabled !== undefined) {
        setVWC(closeDisabled, realCloseDisabled.get());
      }
    }
  }, [realCloseDisabled, closeDisabled]);

  const onCloseClick = useCallback(() => {
    if (realCloseDisabled.get()) {
      return;
    }

    resources.get().session?.storeAction('dismiss', null);
    resources.get().session?.reset();
    state.get().onDismissed();
  }, [resources, state, realCloseDisabled]);
  if (onDismiss !== undefined) {
    setVWC(onDismiss, onCloseClick);
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.background} />
      <div className={styles.contentContainer}>
        <div className={styles.closeButtonContainer}>
          <IconButton icon={styles.closeIcon} srOnlyName="Close" onClick={onCloseClick} />
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
};
