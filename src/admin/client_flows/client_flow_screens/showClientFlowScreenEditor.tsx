import { Modals, addModalWithCallbackToRemove } from '../../../shared/contexts/ModalContext';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { constructCancelablePromise } from '../../../shared/lib/CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from '../../../shared/lib/createCancelablePromiseFromCallbacks';
import { Saveable } from '../../../shared/models/Saveable';
import { ClientFlowScreen } from './ClientFlowScreen';
import { ClientFlowScreenEditorModal } from './ClientFlowScreenEditorModal';

/**
 * Shows a popup where the user can see the given flow screen and modify it.
 * They can close the screen either with a save button or by clicking outside
 * of the modal and answering a confirmation dialog for whether or not to keep
 * changes.
 *
 * @param modals Where to show the popup.
 * @param flow The flow configuration to use for tests
 * @param flowScreenSaveable The saveable client flow screen
 * @param onDelete If specified, a delete button is shown and this is called after
 *   the user clicks it and confirms they want to remove the screen from the flow.
 *   The caller is responsible for canceling the returned promise in this case.
 * @returns The modified flow screen, or null if the user cancels.
 */
export const showClientFlowScreenEditor = (
  modals: WritableValueWithCallbacks<Modals>,
  flow: ValueWithCallbacks<{
    clientSchema: any;
    serverSchema: any;
  }>,
  flowScreenSaveable: Saveable<ClientFlowScreen>,
  onDelete?: () => void
): CancelablePromise<void> => {
  return constructCancelablePromise({
    body: async (state, resolve, reject) => {
      const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
      canceled.promise.catch(() => {});

      if (state.finishing) {
        canceled.cancel();
        state.done = true;
        reject(new Error('canceled'));
        return;
      }

      let resolveDismissed = () => {};
      const dismissed = new Promise<void>((resolve) => {
        resolveDismissed = resolve;
      });

      const requestDismiss = createWritableValueWithCallbacks<() => void>(() => {});
      const closeClientFlowScreenModal = addModalWithCallbackToRemove(
        modals,
        <ClientFlowScreenEditorModal
          flow={flow}
          flowScreenSaveable={flowScreenSaveable}
          onDismiss={resolveDismissed}
          requestDismiss={requestDismiss}
          onDelete={onDelete}
        />
      );

      await Promise.race([dismissed, canceled.promise]);

      if (state.finishing) {
        resolveDismissed();
        closeClientFlowScreenModal();
        state.done = true;
        reject(new Error('canceled'));
        return;
      }

      canceled.cancel();
      closeClientFlowScreenModal();
      state.finishing = true;
      state.done = true;
      resolve();
    },
  });
};
