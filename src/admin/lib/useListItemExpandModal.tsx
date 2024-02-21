import { ReactElement, useCallback, useContext } from 'react';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';
import {
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../shared/lib/Callbacks';
import { CancelablePromise } from '../../shared/lib/CancelablePromise';
import { constructCancelablePromise } from '../../shared/lib/CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from '../../shared/lib/createCancelablePromiseFromCallbacks';
import { ModalContext, addModalWithCallbackToRemove } from '../../shared/contexts/ModalContext';
import { YesNoModal } from '../../shared/components/YesNoModal';
import { ModalWrapper } from '../../shared/ModalWrapper';
import { setVWC } from '../../shared/lib/setVWC';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';

/**
 * Shows a modal with the content returned from createChild when the returned VWC is
 * set to true.
 *
 * The child can set the editingVWC to true to indicate that closing the modal
 * should involve a confirmation dialog and call to saveIfNecessary if the user
 * wants to save.
 *
 * Changing `createChild` will cause the value to be immediately re-rendered without
 * closing the modal.
 */
export const useListItemExpandModal = (
  createChild: (
    saveIfNecessary: WritableValueWithCallbacks<() => Promise<void>>,
    editingVWC: WritableValueWithCallbacks<boolean>
  ) => ReactElement
): WritableValueWithCallbacks<boolean> => {
  const expandedVWC = useWritableValueWithCallbacks(() => false);
  const modalContext = useContext(ModalContext);
  const realCreateChild = useWritableValueWithCallbacks(() => ({ fn: createChild }));
  setVWC(realCreateChild, { fn: createChild }, (a, b) => Object.is(a.fn, b.fn));

  useValueWithCallbacksEffect(
    expandedVWC,
    useCallback(
      (expanded) => {
        if (!expanded) {
          return undefined;
        }

        const editingVWC = createWritableValueWithCallbacks(false);
        const saveIfNecessary = createWritableValueWithCallbacks(async (): Promise<void> => {});
        let confirmingClose: CancelablePromise<boolean> | null = null;

        const confirmClose = (): CancelablePromise<boolean> => {
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

              let answered = false;

              const requestDismiss = createWritableValueWithCallbacks<() => void>(() => {});
              const closeConfirmModal = addModalWithCallbackToRemove(
                modalContext.modals,
                <YesNoModal
                  title="Save changes?"
                  body="Do you want to save your changes?"
                  cta1="Save"
                  cta2="Discard changes"
                  emphasize={1}
                  onDismiss={() => {
                    closeConfirmModal();
                    resolveDismissed();
                  }}
                  requestDismiss={requestDismiss}
                  onClickOne={async () => {
                    answered = true;
                    await saveIfNecessary.get()();
                    requestDismiss.get()();
                  }}
                  onClickTwo={async () => {
                    answered = true;
                    requestDismiss.get()();
                  }}
                />
              );

              await Promise.race([dismissed, canceled.promise]);

              if (state.finishing) {
                resolveDismissed();
                closeConfirmModal();
                state.done = true;
                reject(new Error('canceled'));
                return;
              }

              state.finishing = true;
              state.done = true;
              resolve(answered);
            },
          });
        };

        const handleCloseRequested = () => {
          if (confirmingClose !== null) {
            return;
          }

          if (editingVWC.get()) {
            confirmingClose = confirmClose();
            confirmingClose.promise.then((answered) => {
              if (answered) {
                handleClosed();
              }
            });
            confirmingClose.promise.catch(() => {});
            confirmingClose.promise.finally(() => {
              confirmingClose = null;
            });
          } else {
            handleClosed();
          }
        };

        const handleClosed = () => {
          confirmingClose?.cancel();
          confirmingClose = null;
          setVWC(expandedVWC, false);
          closeModal();
        };

        const closeModal = addModalWithCallbackToRemove(
          modalContext.modals,
          <ModalWrapper onClosed={handleCloseRequested} minimalStyling>
            <RenderGuardedComponent
              props={realCreateChild}
              component={(child) => child.fn(saveIfNecessary, editingVWC)}
            />
          </ModalWrapper>
        );

        return () => {
          handleClosed();
        };
      },
      [modalContext.modals, expandedVWC]
    )
  );

  return expandedVWC;
};
