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
import { Instructor } from './Instructor';
import { InstructorPicker } from './InstructorPicker';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { adaptValueWithCallbacksAsSetState } from '../../shared/lib/adaptValueWithCallbacksAsSetState';
import styles from './showInstructorPicker.module.css';
import { OsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { useMappedValuesWithCallbacks } from '../../shared/hooks/useMappedValuesWithCallbacks';

/**
 * Opens a modal to allow the user to pick an instructor, then
 * resolves the instructor selected (if they chose one), or null
 * if they dismissed the modal without picking an instructor.
 *
 * Can cancel the returned promise to close the modal, which will
 * cause the promise to be rejected.
 */
export const showInstructorPicker = ({
  modals,
  imageHandler,
}: {
  modals: WritableValueWithCallbacks<Modals>;
  imageHandler: OsehImageStateRequestHandler;
}): CancelablePromise<Instructor | null> => {
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
      let selected: Instructor | null = null;

      let closedPromiseResolve: () => void = () => {};
      const closedPromise = new Promise<void>((resolve) => {
        closedPromiseResolve = resolve;
      });

      const closeModal = addModalWithCallbackToRemove(
        modals,
        <SlideInModal
          title="Pick the instructor"
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
            imageHandler={imageHandler}
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
  imageHandler,
}: {
  onClick: (item: Instructor) => void;
  disabled: ValueWithCallbacks<boolean>;
  imageHandler: OsehImageStateRequestHandler;
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
          <InstructorPicker
            query={query}
            setQuery={adaptValueWithCallbacksAsSetState(queryVWC)}
            setSelected={onClick}
            imageHandler={imageHandler}
            disabled={disabled}
          />
        )}
        applyInstantly
      />
    </div>
  );
};
