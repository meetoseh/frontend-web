import { ReactElement, useEffect } from 'react';
import {
  useWritableValueWithCallbacks,
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  WritableValueWithTypedCallbacks,
} from '../lib/Callbacks';
import { createValueWithCallbacksEffect } from '../hooks/createValueWithCallbacksEffect';
import { setVWC } from '../lib/setVWC';
import { useValuesWithCallbacksEffect } from '../hooks/useValuesWithCallbacksEffect';
import styles from './ResizingTextArea.module.css';
import { HorizontalSpacer } from './HorizontalSpacer';

export type ResizingTextAreaProps = {
  /** The styling variant to use */
  variant: 'dark';
  /** The text shown when the textarea is not focused and they haven't written anything */
  placeholder: string;
  /** Configures a submit button in the textarea; null for no submit button */
  submit: { icon: ReactElement; onClick: () => void } | null;
  /**
   * The value of the textarea. When the callback is invoked with
   * `{ updateInput: true }` or `undefined`, we set the value of the input. If it's
   * called with `{ updateInput: false }`, we don't set the value of the input.
   * Whenever this is set by this component, `{ updateInput: false }` is used.
   */
  value: WritableValueWithTypedCallbacks<string, { updateInput: boolean } | undefined>;
  /** We store the ref to the input here, if provided */
  refVWC?: WritableValueWithCallbacks<HTMLTextAreaElement | null>;
  /** If the text area should be editable; undefined for always editable */
  editable?: ValueWithCallbacks<boolean> | boolean;

  enterBehavior: 'never-submit' | 'submit-unless-shift' | 'submit-if-ctrl';
};

/** Suggested settings for the resizing text area icon */
export const RESIZING_TEXT_AREA_ICON_SETTINGS = {
  icon: { width: 24 },
  container: { width: 56, height: 48 },
  startPadding: { x: { fraction: 0.5 }, y: { fraction: 0.5 } },
} as const;

/**
 * Shows a text area that automatically resizes to match the content size
 * and optionally includes a submit icon button within the visual border.
 */
export const ResizingTextArea = (props: ResizingTextAreaProps) => {
  const refVWC = useWritableValueWithCallbacks<HTMLTextAreaElement | null>(() => null);
  useEffect(() => {
    if (props.refVWC === undefined) {
      return;
    }
    const propRef = props.refVWC;
    return createValueWithCallbacksEffect(refVWC, (r) => {
      setVWC(propRef, r);
      return undefined;
    });
  }, [props.refVWC]);

  const editableVWC = useWritableValueWithCallbacks<boolean>(() =>
    props.editable === undefined
      ? true
      : props.editable === true || props.editable === false
      ? props.editable
      : props.editable.get()
  );
  useEffect(() => {
    if (props.editable === undefined || props.editable === true) {
      setVWC(editableVWC, true);
      return;
    }

    if (props.editable === false) {
      setVWC(editableVWC, false);
      return;
    }

    const propEditable = props.editable;
    return createValueWithCallbacksEffect(propEditable, (e) => {
      setVWC(editableVWC, e);
      return undefined;
    });
  }, [props.editable]);

  useEffect(() => {
    const refRaw = refVWC.get();
    if (refRaw === null) {
      return;
    }
    const input = refRaw;

    const fixInput = () => {
      input.style.height = '5px';
      input.style.height = `${input.scrollHeight}px`;
    };

    input.value = props.value.get();
    fixInput();

    input.addEventListener('keydown', onKeyDown);
    input.addEventListener('change', onChangeOrInput);
    input.addEventListener('input', onChangeOrInput);
    props.value.callbacks.add(onValueCallbacks);
    return () => {
      input.removeEventListener('keydown', onKeyDown);
      input.removeEventListener('change', onChangeOrInput);
      input.removeEventListener('input', onChangeOrInput);
      props.value.callbacks.remove(onValueCallbacks);
    };

    function onKeyDown(e: KeyboardEvent) {
      if (props.enterBehavior === 'submit-if-ctrl' && e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        props.submit?.onClick();
        return;
      }

      if (props.enterBehavior === 'submit-unless-shift' && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        props.submit?.onClick();
        return;
      }

      if (props.value.get() !== input.value) {
        fixInput();
        props.value.set(input.value);
        props.value.callbacks.call({ updateInput: false });
      }
    }

    function onChangeOrInput() {
      if (props.value.get() !== input.value) {
        fixInput();
        props.value.set(input.value);
        props.value.callbacks.call({ updateInput: false });
      }
    }

    function onValueCallbacks(e: { updateInput: boolean } | undefined) {
      if (e === undefined || e.updateInput) {
        input.value = props.value.get();
        fixInput();
      }
    }
  }, [props.value, refVWC]);

  useValuesWithCallbacksEffect([refVWC, editableVWC], () => {
    const ref = refVWC.get();
    if (ref !== null) {
      ref.readOnly = !editableVWC.get();
    }
    return undefined;
  });

  if (props.submit === null) {
    return (
      <textarea
        className={styles.simple}
        ref={(r) => setVWC(refVWC, r)}
        rows={1}
        placeholder={props.placeholder}
      />
    );
  }

  return (
    <div className={styles.container}>
      <textarea
        className={styles.textarea}
        ref={(r) => setVWC(refVWC, r)}
        rows={1}
        placeholder={props.placeholder}
      />
      <HorizontalSpacer width={6} />
      <button className={styles.submit} onClick={props.submit.onClick}>
        {props.submit.icon}
      </button>
    </div>
  );
};
