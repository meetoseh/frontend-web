import { ReactElement } from 'react';
import { SlideInModal } from '../../shared/components/SlideInModal';
import { Modals, addModalWithCallbackToRemove } from '../../shared/contexts/ModalContext';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../shared/lib/Callbacks';
import { CancelablePromise } from '../../shared/lib/CancelablePromise';
import { constructCancelablePromise } from '../../shared/lib/CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from '../../shared/lib/createCancelablePromiseFromCallbacks';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import styles from './showTextInputModal.module.css';
import { useMappedValuesWithCallbacks } from '../../shared/hooks/useMappedValuesWithCallbacks';
import { TextInput, TextInputProps } from '../forms/TextInput';
import { setVWC } from '../lib/setVWC';

/**
 * Opens a modal to allow the user to enter a value. Generally
 * for the admin area
 */
export const showTextInputModal = ({
  modals,
  props,
}: {
  modals: WritableValueWithCallbacks<Modals>;
  props: Omit<TextInputProps, 'value' | 'setValue' | 'disabled' | 'onChange' | 'inputStyle'>;
}): CancelablePromise<string | null> => {
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
      const value = createWritableValueWithCallbacks<string>('');

      let closedPromiseResolve: () => void = () => {};
      const closedPromise = new Promise<void>((resolve) => {
        closedPromiseResolve = resolve;
      });

      const closeModal = addModalWithCallbackToRemove(
        modals,
        <SlideInModal
          title={props.label}
          onClosed={() => {
            closedPromiseResolve();
          }}
          requestClose={requestClose}
          animating={disabled}>
          <Inner value={value} props={props} disabled={disabled} />
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
        resolve(value.get());
      }
    },
  });
};

const Inner = ({
  value: valueVWC,
  disabled,
  props,
}: {
  value: WritableValueWithCallbacks<string>;
  disabled: ValueWithCallbacks<boolean>;
  props: Omit<TextInputProps, 'value' | 'setValue' | 'disabled' | 'onChange' | 'inputStyle'>;
}): ReactElement => {
  const stateVWC = useMappedValuesWithCallbacks([valueVWC, disabled], () => ({
    value: valueVWC.get(),
    disabled: disabled.get(),
  }));

  return (
    <div className={styles.container}>
      <RenderGuardedComponent
        props={stateVWC}
        component={({ value, disabled }) => (
          <TextInput
            {...props}
            value={value}
            onChange={(v) => setVWC(valueVWC, v)}
            disabled={disabled}
            inputStyle="white"
          />
        )}
        applyInstantly
      />
    </div>
  );
};
