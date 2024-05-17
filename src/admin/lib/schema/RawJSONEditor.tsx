import { ReactElement } from 'react';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';
import { useDelayedValueWithCallbacks } from '../../../shared/hooks/useDelayedValueWithCallbacks';
import { setVWC } from '../../../shared/lib/setVWC';
import { useValuesWithCallbacksEffect } from '../../../shared/hooks/useValuesWithCallbacksEffect';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import styles from './RawJSONEditor.module.css';

/**
 * The most basic way that an OpenAPI 3.0.3 schema can be edited is by simply
 * giving them a textarea to edit the JSON directly. This doesn't perform any
 * verification itself on the schema beyond that it's valid JSON. It will
 * re-indent the JSON for them.
 *
 * This intentionally doesn't reformat the json until they lose focus on the
 * textarea (e.g., via the actual `change` event, not reacts onChange callback)
 */
export const RawJSONEditor = ({
  canonicalVWC,
  setValue,
  rows,
}: {
  canonicalVWC: ValueWithCallbacks<any>;
  setValue: (v: any) => void;
  rows?: number;
}): ReactElement => {
  const canonicalTextVWC = useMappedValueWithCallbacks(canonicalVWC, (v) =>
    JSON.stringify(v, undefined, 2)
  );
  const textVWC = useWritableValueWithCallbacks<string>(() => canonicalTextVWC.get());
  useValueWithCallbacksEffect(canonicalTextVWC, (v) => {
    setVWC(textVWC, v);
    return undefined;
  });
  const errorVWC = useWritableValueWithCallbacks<string | null>(() => null);
  useValueWithCallbacksEffect(useDelayedValueWithCallbacks(textVWC, 1), (text) => {
    setVWC(errorVWC, null);
    if (text === canonicalTextVWC.get()) {
      return;
    }
    try {
      const parsed = JSON.parse(text);
      setValue(parsed);
    } catch (e) {
      console.log('error', e);
      if (
        typeof e === 'object' &&
        e !== null &&
        'message' in e &&
        typeof (e as any).message === 'string'
      ) {
        setVWC(errorVWC, (e as any).message);
      } else {
        setVWC(errorVWC, 'Unknown error while parsing');
      }
    }
    return undefined;
  });
  const textareaRef = useWritableValueWithCallbacks<HTMLTextAreaElement | null>(() => null);
  useValuesWithCallbacksEffect([canonicalTextVWC, textareaRef], () => {
    const refRaw = textareaRef.get();
    if (refRaw === null) {
      return undefined;
    }
    const ref = refRaw;
    ref.value = canonicalTextVWC.get();
    ref.addEventListener('change', handleChange);
    return () => {
      ref.removeEventListener('change', handleChange);
    };
    function handleChange() {
      setVWC(textVWC, ref.value);
    }
  });

  return (
    <div className={styles.container}>
      <textarea ref={(r) => setVWC(textareaRef, r)} rows={rows ?? 10} />
      <RenderGuardedComponent
        props={errorVWC}
        component={(error) =>
          error === null ? <></> : <div className={styles.error}>{error}</div>
        }
      />
    </div>
  );
};
