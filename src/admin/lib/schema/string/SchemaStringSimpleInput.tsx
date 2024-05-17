import { ReactElement } from 'react';
import { SchemaInputProps } from '../SchemaInputProps';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import styles from './SchemaStringSimpleInput.module.css';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { setVWC } from '../../../../shared/lib/setVWC';
import { TextInput } from '../../../../shared/forms/TextInput';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';

/**
 * Allows the user to input a fixed string value to fill in the schema.
 * Only works if the schema is a string type.
 *
 * Supported validation properties:
 * - `maxLength`
 * - `minLength`
 * - `pattern`
 * - `enum`
 */
export const SchemaStringSimpleInput = ({
  path,
  schema,
  value,
}: SchemaInputProps): ReactElement => {
  if (schema.type !== 'string') {
    throw new Error('SchemaStringSimple only works with string schemas');
  }

  const errorVWC = useMappedValueWithCallbacks(
    value,
    (text) => {
      if ('maxLength' in schema) {
        const maxLength = schema.maxLength;
        if (
          typeof maxLength === 'number' &&
          Number.isSafeInteger(maxLength) &&
          text.length > schema.maxLength
        ) {
          return <>The string must be at most {maxLength.toLocaleString()} characters long</>;
        }
      }

      if ('minLength' in schema) {
        const minLength = schema.minLength;
        if (
          typeof minLength === 'number' &&
          Number.isSafeInteger(minLength) &&
          text.length < schema.minLength
        ) {
          return <>The string must be at least {minLength.toLocaleString()} characters long</>;
        }
      }

      if ('pattern' in schema) {
        const pattern = schema.pattern;
        if (typeof pattern === 'string') {
          if (!new RegExp(pattern).test(text)) {
            return <>The string must match the pattern {pattern}</>;
          }
        }
      }

      if ('enum' in schema) {
        const enumValues = schema.enum;
        if (Array.isArray(enumValues) && !enumValues.includes(text)) {
          return <>The string must be one of: {enumValues.join(', ')}</>;
        }
      }

      return null;
    },
    {
      inputEqualityFn: () => false,
    }
  );
  const isErrorVWC = useMappedValueWithCallbacks(errorVWC, (error) => error !== null);

  return (
    <div className={styles.container}>
      <RenderGuardedComponent
        props={useMappedValuesWithCallbacks([value, isErrorVWC], () => ({
          text: value.get() ?? '',
          inputStyle: (isErrorVWC.get() ? 'error' : 'normal') as 'error' | 'normal',
        }))}
        component={(v) => (
          <TextInput
            type="text"
            value={v.text}
            inputStyle={v.inputStyle}
            onChange={(v) => setVWC(value, v)}
            label={schema.title ?? path[path.length - 1] ?? '(no title or path)'}
            help={
              <>
                {schema.description && <p>{schema.description}</p>}
                <RenderGuardedComponent
                  props={errorVWC}
                  component={(error) => (error === null ? <></> : <p>{error}</p>)}
                />
              </>
            }
            html5Validation={{
              maxLength: schema.maxLength,
              minLength: schema.minLength,
              pattern: schema.pattern,
            }}
            disabled={false}
          />
        )}
        applyInstantly
      />
    </div>
  );
};
