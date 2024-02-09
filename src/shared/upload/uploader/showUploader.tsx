import { SlideInModal } from '../../components/SlideInModal';
import { Modals, addModalWithCallbackToRemove } from '../../contexts/ModalContext';
import { WritableValueWithCallbacks, createWritableValueWithCallbacks } from '../../lib/Callbacks';
import { CancelablePromise } from '../../lib/CancelablePromise';
import { constructCancelablePromise } from '../../lib/CancelablePromiseConstructor';
import { UploaderContent, UploaderContentProps } from './UploaderContent';

/**
 * Shows a modal where the user can upload a file and wait for it
 * to be processed on the server, then returns the result of the
 * processing or undefined if the user cancelled the upload.
 *
 * The returned promise can be canceled to close the modal immediately.
 */
export const showUploader = <T extends object>({
  modals,
  content,
}: {
  modals: WritableValueWithCallbacks<Modals>;
  content: Omit<UploaderContentProps<T>, 'onUploaded'>;
}): CancelablePromise<T | undefined> => {
  return constructCancelablePromise({
    body: async (state, resolve, reject) => {
      if (state.finishing) {
        state.done = true;
        reject(new Error('canceled'));
        return;
      }

      const requestClose = createWritableValueWithCallbacks<() => void>(() => {});
      const disabled = createWritableValueWithCallbacks<boolean>(true);
      let uploadedItem: T | undefined = undefined;
      let canceled = false;

      const onCanceled = () => {
        state.cancelers.remove(onCanceled);
        canceled = true;
        requestClose.get()();
      };

      let closedPromiseResolve: () => void = () => {};
      const closedPromise = new Promise<void>((resolve) => {
        closedPromiseResolve = resolve;
      });

      const closeModal = addModalWithCallbackToRemove(
        modals,
        <SlideInModal
          title="Upload"
          onClosed={() => {
            if (!state.finishing) {
              state.cancelers.remove(onCanceled);
              state.finishing = true;
              state.done = true;
              if (canceled) {
                reject(new Error('canceled'));
              } else {
                resolve(uploadedItem);
              }
            }

            closeModal();
            closedPromiseResolve();
          }}
          requestClose={requestClose}
          animating={disabled}>
          <UploaderContent
            {...content}
            onUploaded={(item) => {
              if (state.finishing) {
                return;
              }

              state.cancelers.remove(onCanceled);
              uploadedItem = item;
              requestClose.get()();
            }}
          />
        </SlideInModal>
      );

      state.cancelers.add(onCanceled);
      if (state.finishing) {
        state.cancelers.remove(onCanceled);
        closeModal();
        closedPromiseResolve();
        state.done = true;
        reject(new Error('canceled'));
      }

      await closedPromise;
    },
  });
};
