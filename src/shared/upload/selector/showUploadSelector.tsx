import { SlideInModal } from '../../components/SlideInModal';
import { Modals, addModalWithCallbackToRemove } from '../../contexts/ModalContext';
import { WritableValueWithCallbacks, createWritableValueWithCallbacks } from '../../lib/Callbacks';
import { CancelablePromise } from '../../lib/CancelablePromise';
import { constructCancelablePromise } from '../../lib/CancelablePromiseConstructor';
import { SelectorContent, SelectorContentProps } from './SelectorContent';

/**
 * Uses the given modals to show an upload selector, which fulfills a
 * promise once an item is selected and fulfills with `undefined` if
 * the modal is closed without selecting an item.
 *
 * The returned promise can be canceled to hide the modal without
 * user interaction, which will cause the promise to be rejected
 * with the 'canceled' error.
 */
export const showUploadSelector = <T extends object>({
  modals,
  content,
}: {
  modals: WritableValueWithCallbacks<Modals>;
  content: Omit<SelectorContentProps<T>, 'onClick'>;
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
      let clickedItem: T | undefined = undefined;
      let canceled = false;

      const onCanceled = () => {
        state.cancelers.remove(onCanceled);
        canceled = true;
        requestClose.get()();
      };

      const closeModal = addModalWithCallbackToRemove(
        modals,
        <SlideInModal
          title="Choose one"
          onClosed={() => {
            if (!state.finishing) {
              state.cancelers.remove(onCanceled);
              state.finishing = true;
              state.done = true;
              if (canceled) {
                reject(new Error('canceled'));
              } else {
                resolve(clickedItem);
              }
            }

            closeModal();
          }}
          requestClose={requestClose}
          animating={disabled}>
          <SelectorContent
            {...content}
            onClick={(item) => {
              if (state.finishing) {
                return;
              }

              state.cancelers.remove(onCanceled);
              clickedItem = item;
              requestClose.get()();
            }}
          />
        </SlideInModal>
      );

      state.cancelers.add(onCanceled);
      if (state.finishing) {
        state.cancelers.remove(onCanceled);
        closeModal();
        state.done = true;
        reject(new Error('canceled'));
      }
    },
  });
};
