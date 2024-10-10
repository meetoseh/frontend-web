import { ReactElement, useEffect } from 'react';
import {
  useWritableValueWithCallbacks,
  ValueWithCallbacks,
  WritableValueWithCallbacks,
} from '../lib/Callbacks';
import { createValueWithCallbacksEffect } from '../hooks/createValueWithCallbacksEffect';
import { setVWC } from '../lib/setVWC';
import { useValuesWithCallbacksEffect } from '../hooks/useValuesWithCallbacksEffect';
import styles from './ResizingTextArea.module.css';
import { HorizontalSpacer } from './HorizontalSpacer';
import { RenderGuardedComponent } from './RenderGuardedComponent';
import { useMappedValueWithCallbacks } from '../hooks/useMappedValueWithCallbacks';

export type ResizingTextAreaProps = {
  /** The styling variant to use */
  variant: 'dark';
  /** The text shown when the textarea is not focused and they haven't written anything */
  placeholder: string;
  /** Configures a submit button in the textarea; null for no submit button */
  submit: ValueWithCallbacks<{ icon: ReactElement; onClick: () => void } | null>;
  /** The value of the textarea */
  value: ValueWithCallbacks<string>;
  /** Called when the user changes the value of the text area */
  onValueChanged: (v: string) => void;
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
  }, [props.refVWC, refVWC]);

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
  }, [props.editable, editableVWC]);

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
    props.value.callbacks.add(fixInput);
    return () => {
      input.removeEventListener('keydown', onKeyDown);
      props.value.callbacks.remove(fixInput);
    };

    function onKeyDown(e: KeyboardEvent) {
      if (props.enterBehavior === 'submit-if-ctrl' && e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        props.submit.get()?.onClick();
        return;
      }

      if (props.enterBehavior === 'submit-unless-shift' && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        props.submit.get()?.onClick();
        return;
      }
    }
  }, [props.value, props.enterBehavior, props.submit, refVWC]);

  useValuesWithCallbacksEffect([refVWC, editableVWC], () => {
    const ref = refVWC.get();
    if (ref !== null) {
      ref.readOnly = !editableVWC.get();
    }
    return undefined;
  });

  const submitIsNullVWC = useMappedValueWithCallbacks(props.submit, (s) => s === null);

  return (
    <RenderGuardedComponent
      props={submitIsNullVWC}
      component={(submitIsNull) =>
        submitIsNull ? (
          <RenderGuardedComponent
            props={props.value}
            component={(value) => (
              <textarea
                className={styles.simple}
                ref={(r) => setVWC(refVWC, r)}
                rows={1}
                placeholder={props.placeholder}
                value={value}
                onChange={(e) => props.onValueChanged(e.target.value)}
              />
            )}
            applyInstantly
          />
        ) : (
          <div className={styles.container}>
            <RenderGuardedComponent
              props={props.value}
              component={(value) => (
                <textarea
                  className={styles.textarea}
                  ref={(r) => setVWC(refVWC, r)}
                  rows={1}
                  placeholder={props.placeholder}
                  value={value}
                  onChange={(e) => props.onValueChanged(e.target.value)}
                />
              )}
              applyInstantly
            />
            <HorizontalSpacer width={6} />
            <RenderGuardedComponent
              props={props.submit}
              component={(submit) =>
                submit === null ? (
                  <></>
                ) : (
                  <button className={styles.submit} onClick={submit.onClick}>
                    {submit.icon}
                  </button>
                )
              }
            />
          </div>
        )
      }
    />
  );
};
