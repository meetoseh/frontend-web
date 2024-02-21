import { YesNoModal, YesNoModalProps } from '../components/YesNoModal';
import { Modals, addModalWithCallbackToRemove } from '../contexts/ModalContext';
import { WritableValueWithCallbacks, createWritableValueWithCallbacks } from './Callbacks';
import { CancelablePromise } from './CancelablePromise';
import { constructCancelablePromise } from './CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from './createCancelablePromiseFromCallbacks';

/**
 * Shows the yes/no modal with the given props in the form of a cancelable
 * promise. The promise resolves to true if the user clicks the first button,
 * false if the user clicks the second button, and null if the user dismisses
 * the modal without choosing either option.
 *
 * @param modals Where to inject the modal
 * @param props The props to pass to the yes/no modal; the ones related to
 *   what was selected and dismissing the modal are handled by this function:
 *   the response selected is in the resolved result, the user dismissing the
 *   modal is the null resolved result, and if you need to request dismissal
 *   then cancel the returned promise.
 * @returns The user's choice, rejecting on cancellation
 */
export const showYesNoModal = (
  modals: WritableValueWithCallbacks<Modals>,
  props: Omit<YesNoModalProps, 'onClickOne' | 'onClickTwo' | 'onDismiss' | 'requestDismiss'>
): CancelablePromise<boolean | null> => {
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

      let answer: boolean | null = null;

      const requestDismiss = createWritableValueWithCallbacks<() => void>(() => {});
      const closeYesNoModal = addModalWithCallbackToRemove(
        modals,
        <YesNoModal
          {...props}
          onDismiss={() => {
            closeYesNoModal();
            resolveDismissed();
          }}
          requestDismiss={requestDismiss}
          onClickOne={async () => {
            answer = true;
            requestDismiss.get()();
          }}
          onClickTwo={async () => {
            answer = false;
            requestDismiss.get()();
          }}
        />
      );

      await Promise.race([dismissed, canceled.promise]);

      if (state.finishing) {
        resolveDismissed();
        closeYesNoModal();
        state.done = true;
        reject(new Error('canceled'));
        return;
      }

      state.finishing = true;
      state.done = true;
      resolve(answer);
    },
  });
};
