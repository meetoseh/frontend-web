import { useEffect } from 'react';
import {
  useWritableValueWithCallbacks,
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  WritableValueWithTypedCallbacks,
} from '../lib/Callbacks';
import { createValueWithCallbacksEffect } from '../hooks/createValueWithCallbacksEffect';
import { setVWC } from '../lib/setVWC';
import { useValuesWithCallbacksEffect } from '../hooks/useValuesWithCallbacksEffect';
import styles from './FlexGrowContentWidthTextArea.module.css';
import { combineClasses } from '../lib/combineClasses';
import { useMappedValueWithCallbacks } from '../hooks/useMappedValueWithCallbacks';
import { useStyleVWC } from '../hooks/useStyleVWC';

export type FlexGrowContentWidthTextAreaProps = {
  /**
   * The style to use for the text
   */
  textClassName: string;
  /** The text shown when the textarea is not focused and they haven't written anything */
  placeholder: string;
  /** unused on native */
  submit: { onClick: () => void } | null;
  /**
   * The value of the textarea. When the callback is invoked by this component
   * we set updateInput to false. Whenever its invoked by other components, it
   * should be set to true. Only used on the web.
   */
  value: WritableValueWithTypedCallbacks<string, { updateInput: boolean } | undefined>;
  /** We store the ref to the input here, if provided */
  refVWC?: WritableValueWithCallbacks<HTMLTextAreaElement | null>;
  /** If the text area should be editable; undefined for always editable */
  editable?: ValueWithCallbacks<boolean> | boolean;
  /** the content width to use */
  contentWidth: ValueWithCallbacks<number>;
  /** the screen width to use */
  screenWidth: ValueWithCallbacks<number>;
  /** unused on native */
  enterBehavior: 'never-submit' | 'submit-unless-shift' | 'submit-if-ctrl';
};

/**
 * A minimally sized multiline text input which grows to fill the available
 * height. Specifically, this grows the same as
 * `<VerticalSpacer height={0} flexGrow={1} />`
 */
export const FlexGrowContentWidthTextArea = (props: FlexGrowContentWidthTextAreaProps) => {
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

    input.value = props.value.get();

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
        props.value.set(input.value);
        props.value.callbacks.call({ updateInput: false });
      }
    }

    function onChangeOrInput() {
      if (props.value.get() !== input.value) {
        props.value.set(input.value);
        props.value.callbacks.call({ updateInput: false });
      }
    }

    function onValueCallbacks(e: { updateInput: boolean } | undefined) {
      if (e === undefined || e.updateInput) {
        input.value = props.value.get();
      }
    }
  }, [props.value, refVWC, props.enterBehavior, props.submit]);

  useValuesWithCallbacksEffect([refVWC, editableVWC], () => {
    const ref = refVWC.get();
    if (ref !== null) {
      ref.readOnly = !editableVWC.get();
    }
    return undefined;
  });

  const styleVWC = useMappedValueWithCallbacks(props.contentWidth, (cw) => ({ width: `${cw}px` }));
  useStyleVWC(refVWC, styleVWC);

  return (
    <textarea
      className={combineClasses(styles.simple, props.textClassName)}
      style={styleVWC.get()}
      ref={(r) => setVWC(refVWC, r)}
      rows={1}
      placeholder={props.placeholder}
    />
  );
};
