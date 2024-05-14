import { ReactElement } from 'react';
import { SlideInModal } from '../../shared/components/SlideInModal';
import { Modals, addModalWithCallbackToRemove } from '../../shared/contexts/ModalContext';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../shared/lib/Callbacks';
import { CancelablePromise } from '../../shared/lib/CancelablePromise';
import { constructCancelablePromise } from '../../shared/lib/CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from '../../shared/lib/createCancelablePromiseFromCallbacks';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { adaptValueWithCallbacksAsSetState } from '../../shared/lib/adaptValueWithCallbacksAsSetState';
import styles from './showClientScreenPicker.module.css';
import { useMappedValuesWithCallbacks } from '../../shared/hooks/useMappedValuesWithCallbacks';
import { ClientScreen } from './ClientScreen';
import { ClientScreenPicker } from './ClientScreenPicker';

/**
 * Opens a modal to allow the user to pick a client screen, then
 * resolves the client screen selected (if they chose one), or null
 * if they dismissed the modal without picking any.
 *
 * Can cancel the returned promise to close the modal, which will
 * cause the promise to be rejected.
 */
export const showClientScreenPicker = ({
  modals,
}: {
  modals: WritableValueWithCallbacks<Modals>;
}): CancelablePromise<ClientScreen | null> => {
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

      const requestClose = createWritableValueWithCallbacks<() => void>(() => {});
      const disabled = createWritableValueWithCallbacks<boolean>(true);
      let selected: ClientScreen | null = null;

      let closedPromiseResolve: () => void = () => {};
      const closedPromise = new Promise<void>((resolve) => {
        closedPromiseResolve = resolve;
      });

      const closeModal = addModalWithCallbackToRemove(
        modals,
        <SlideInModal
          title="Pick the client screen"
          onClosed={() => {
            closedPromiseResolve();
          }}
          requestClose={requestClose}
          animating={disabled}>
          <Inner
            onClick={(itm) => {
              selected = itm;
              requestClose.get()();
            }}
            disabled={disabled}
          />
        </SlideInModal>
      );

      try {
        await Promise.race([closedPromise, canceled.promise]);
      } finally {
        closeModal();
        closedPromiseResolve();
        canceled.cancel();

        state.finishing = true;
        state.done = true;
        resolve(selected);
      }
    },
  });
};

const Inner = ({
  onClick,
  disabled,
}: {
  onClick: (item: ClientScreen) => void;
  disabled: ValueWithCallbacks<boolean>;
}): ReactElement => {
  const queryVWC = useWritableValueWithCallbacks<string>(() => '');
  const stateVWC = useMappedValuesWithCallbacks([queryVWC, disabled], () => ({
    query: queryVWC.get(),
    disabled: disabled.get(),
  }));

  return (
    <div className={styles.container}>
      <RenderGuardedComponent
        props={stateVWC}
        component={({ query, disabled }) => (
          <ClientScreenPicker
            query={query}
            setQuery={adaptValueWithCallbacksAsSetState(queryVWC)}
            setSelected={onClick}
            disabled={disabled}
          />
        )}
        applyInstantly
      />
    </div>
  );
};
