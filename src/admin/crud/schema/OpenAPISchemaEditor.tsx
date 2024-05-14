import {
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { setVWC } from '../../../shared/lib/setVWC';
import styles from './OpenAPISchemaEditor.module.css';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';

export type OpenAPIEditableSchema =
  | {
      type: 'unparsable';
      source: string;
    }
  | {
      type: 'pending';
      source: string;
    }
  | {
      type: 'parsed';
      source: string;
      parsed: unknown;
    };

export type OpenAPISchemaEditorProps = {
  /**
   * The schema to edit.
   */
  schema: WritableValueWithCallbacks<OpenAPIEditableSchema>;
};

/**
 * Allows editing an OpenAPI 3.0.3 schema object, parsing with a debounce period.
 */
export const OpenAPISchemaEditor = ({ schema }: OpenAPISchemaEditorProps) => {
  const sourceVWC = useMappedValueWithCallbacks(schema, ({ source }) => source);

  const textareaRef = useWritableValueWithCallbacks<HTMLTextAreaElement | null>(() => null);
  useValueWithCallbacksEffect(textareaRef, (textareaRaw) => {
    if (textareaRaw === null) {
      return undefined;
    }
    const textarea = textareaRaw;
    textarea.value = sourceVWC.get();

    textarea.addEventListener('input', onTextareaInput);
    textarea.addEventListener('change', onTextareaChange);
    return () => {
      textarea.removeEventListener('input', onTextareaInput);
      textarea.removeEventListener('change', onTextareaChange);
    };

    function onTextareaInput() {
      const source = textarea.value;
      setVWC(schema, { type: 'pending', source });
    }

    function onTextareaChange() {
      const source = textarea.value;

      try {
        const parsed = JSON.parse(source);
        const cleanSource = JSON.stringify(parsed, null, 2);
        setVWC(schema, { type: 'parsed', source: cleanSource, parsed });
        textarea.value = cleanSource;
      } catch (e) {
        setVWC(schema, { type: 'unparsable', source });
      }
    }
  });

  return (
    <div className={styles.container}>
      <textarea ref={(r) => setVWC(textareaRef, r)} rows={10} wrap="off" />
    </div>
  );
};
