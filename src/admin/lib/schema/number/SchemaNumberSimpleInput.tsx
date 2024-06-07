import { ReactElement } from 'react';
import { SchemaInputProps } from '../SchemaInputProps';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import styles from './SchemaNumberSimpleInput.module.css';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { setVWC } from '../../../../shared/lib/setVWC';
import { TextInput } from '../../../../shared/forms/TextInput';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';

/**
 * Allows the user to input a fixed number value to fill in the schema.
 * Only works if the schema is a number type.
 *
 * Supported validation properties:
 * - `maximum`
 * - `exclusiveMaximum`
 * - `minimum`
 * - `exclusiveMinimum`
 * - `enum`
 */
export const SchemaNumberSimpleInput = ({
  path,
  schema,
  value,
}: SchemaInputProps): ReactElement => {
  if (
    schema.type !== 'number' &&
    schema.type !== 'integer' &&
    schema.type !== 'float' &&
    schema.type !== 'double'
  ) {
    throw new Error('SchemaNumberSimpleInput only works with number schemas');
  }

  const errorVWC = useMappedValueWithCallbacks(
    value,
    (text: any) => {
      const num = Number(text);
      if (Number.isNaN(num)) {
        return <>The input must be a number</>;
      }

      if ('maximum' in schema) {
        const maximum = schema.maximum;
        if (Number.isSafeInteger(maximum) && num > maximum) {
          return <>The number must be at most {maximum.toLocaleString()}</>;
        }

        if ('exclusiveMaximum' in schema && schema.exclusiveMaximum) {
          if (num === maximum) {
            return <>The number must be less than {maximum.toLocaleString()}</>;
          }
        }
      }

      if ('minimum' in schema) {
        const minimum = schema.minimum;
        if (Number.isSafeInteger(minimum) && num < minimum) {
          return <>The number must be at least {minimum.toLocaleString()}</>;
        }

        if ('exclusiveMinimum' in schema && schema.exclusiveMinimum) {
          if (num === minimum) {
            return <>The number must be greater than {minimum.toLocaleString()}</>;
          }
        }
      }

      if ('enum' in schema) {
        const enumValues = schema.enum;
        if (Array.isArray(enumValues) && !enumValues.includes(num)) {
          return <>The number must be one of: {enumValues.join(', ')}</>;
        }
      }

      if (schema.type === 'integer' && !Number.isInteger(num)) {
        return <>The number must be an integer</>;
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
          text: value.get()?.toString() ?? '',
          inputStyle: (isErrorVWC.get() ? 'error' : 'normal') as 'error' | 'normal',
        }))}
        component={(v) => (
          <TextInput
            type="number"
            value={v.text}
            inputStyle={v.inputStyle}
            onChange={(v) => {
              try {
                const num = Number(v);
                if (Number.isNaN(num)) {
                  return;
                }

                setVWC(value, num);
              } catch (e) {
                setVWC(value, v);
              }
            }}
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
              min: schema.minimum,
              max: schema.maximum,
            }}
            disabled={false}
          />
        )}
        applyInstantly
      />
    </div>
  );
};
