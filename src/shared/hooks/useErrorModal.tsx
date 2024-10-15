import { useCallback } from 'react';
import { Modals, addModalWithCallbackToRemove } from '../contexts/ModalContext';
import { WritableValueWithCallbacks } from '../lib/Callbacks';
import { useValueWithCallbacksEffect } from './useValueWithCallbacksEffect';
import { DisplayableError, SimpleDismissModalBoxError } from '../lib/errors';

/**
 * When an error is set renders a SimpleDismissModalBoxError to the modal
 * context.
 *
 * @param modals The modals to use to show the error
 * @param errorVWC The error to show. We clear the error if dismissed by the user.
 */
export const useErrorModal = (
  modals: WritableValueWithCallbacks<Modals>,
  errorVWC: WritableValueWithCallbacks<DisplayableError | null>
) => {
  useValueWithCallbacksEffect(
    errorVWC,
    useCallback(
      (error) => {
        if (error === null) {
          return undefined;
        }

        return addModalWithCallbackToRemove(
          modals,
          <SimpleDismissModalBoxError error={errorVWC} />
        );
      },
      [modals, errorVWC]
    )
  );
};
