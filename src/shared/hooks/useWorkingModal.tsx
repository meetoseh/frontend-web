import { useCallback } from 'react';
import { WorkingOverlay } from '../components/WorkingOverlay';
import { Modals, addModalWithCallbackToRemove } from '../contexts/ModalContext';
import { ValueWithCallbacks, WritableValueWithCallbacks } from '../lib/Callbacks';
import { useValueWithCallbacksEffect } from './useValueWithCallbacksEffect';

/**
 * Shows a working modal in the given modals list
 * while working is true
 */
export const useWorkingModal = (
  modals: WritableValueWithCallbacks<Modals>,
  working: ValueWithCallbacks<boolean>,
  title?: string,
  progressBarFraction?: ValueWithCallbacks<number>,
  variant?: 'spinner' | 'nospinner'
) => {
  useValueWithCallbacksEffect(
    working,
    useCallback(
      (working) => {
        if (!working) {
          return;
        }

        return addModalWithCallbackToRemove(
          modals,
          <WorkingOverlay
            title={title}
            progressBarFraction={progressBarFraction}
            variant={variant}
          />
        );
      },
      [modals]
    )
  );
};
