import { ModalWrapper } from '../../../../shared/ModalWrapper';
import { Modals, addModalWithCallbackToRemove } from '../../../../shared/contexts/ModalContext';
import { WritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../shared/lib/CancelablePromise';
import { constructCancelablePromise } from '../../../../shared/lib/CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from '../../../../shared/lib/createCancelablePromiseFromCallbacks';
import { User } from '../../User';
import { UserClientScreenActions } from './UserClientScreenActions';
import { UserClientScreenLog } from './UserClientScreenLog';

/**
 * Shows the user client screen actions taken within a given user client screen
 */
export const showUserClientScreenActions = (
  modals: WritableValueWithCallbacks<Modals>,
  props: { user: User; screen: UserClientScreenLog }
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

      const closeModal = addModalWithCallbackToRemove(
        modals,
        <ModalWrapper
          onClosed={() => {
            closeModal();
            resolveDismissed();
          }}>
          <UserClientScreenActions {...props} />
        </ModalWrapper>
      );

      await Promise.race([dismissed, canceled.promise]);

      if (state.finishing) {
        resolveDismissed();
        closeModal();
        state.done = true;
        reject(new Error('canceled'));
        return;
      }

      state.finishing = true;
      state.done = true;
      resolve();
    },
  });
};
