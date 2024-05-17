import { ReactElement, useMemo } from 'react';
import styles from './ClientScreenSchemaStringInput.module.css';
import { ClientScreenSchemaInputProps } from '../ClientScreenSchemaInputProps';
import { useMappedValuesWithCallbacks } from '../../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useMappedValueWithCallbacks } from '../../../../../shared/hooks/useMappedValueWithCallbacks';
import { prettySchemaPath } from '../../../../lib/schema/prettySchemaPath';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { RenderGuardedComponent } from '../../../../../shared/components/RenderGuardedComponent';
import { TextInput } from '../../../../../shared/forms/TextInput';

/**
 * Allows the user to input a fixed or formatted (python curly brackets style,
 * e.g, 'foo {standard[name][full]}') to fill in the schema.
 *
 * Only works if the schema is a string type.
 *
 * Supported validation properties when not using string formatting:
 * - `maxLength`
 * - `minLength`
 * - `pattern`
 * - `enum`
 */
export const ClientScreenSchemaStringInput = ({
  path: outputPath,
  schema,
  value: valueVWC,
  variable: variableMapVWC,
}: ClientScreenSchemaInputProps): ReactElement => {
  if (schema.type !== 'string') {
    throw new Error('SchemaStringSimple only works with string schemas');
  }

  const outputPrettyPath = useMemo(() => prettySchemaPath(outputPath), [outputPath]);

  const variableVWC = useMappedValueWithCallbacks(variableMapVWC, (v) => v.get(outputPrettyPath));
  const isVariableVWC = useMappedValueWithCallbacks(variableVWC, (v) => v !== undefined);
  const textVWC = useMappedValuesWithCallbacks([variableVWC, valueVWC], (): string => {
    const valueAsVariable = variableVWC.get();
    if (valueAsVariable !== undefined && valueAsVariable.type === 'string_format') {
      return valueAsVariable.format;
    }

    return valueVWC.get() ?? '';
  });

  const errorVWC = useMappedValuesWithCallbacks(
    [textVWC, variableVWC],
    () => {
      const text = textVWC.get();
      const variably = variableVWC.get();

      const params = extractParameters(text);
      if (params.length > 0) {
        if (variably === undefined || variably.type !== 'string_format') {
          return <>This should be using a variable input (admin area error?)</>;
        }
        return null;
      } else if (variably !== undefined) {
        return <>This should be using a fixed input (admin area error?)</>;
      }

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
        props={useMappedValuesWithCallbacks([textVWC, isErrorVWC, isVariableVWC], () => ({
          text: textVWC.get() ?? '',
          inputStyle: (isErrorVWC.get() ? 'error' : 'normal') as 'error' | 'normal',
          validates: !isVariableVWC.get(),
        }))}
        component={(v) => (
          <TextInput
            type="text"
            value={v.text}
            inputStyle={v.inputStyle}
            onChange={(v) => {
              if (outputPath.some((v) => typeof v !== 'string')) {
                if (variableVWC.get() !== undefined) {
                  throw new Error('unsupported edit');
                }
                setVWC(valueVWC, v);
                return;
              }

              const params = extractParameters(v);
              if (params.length > 0) {
                const newVariableMap = new Map(variableMapVWC.get());
                newVariableMap.set(outputPrettyPath, {
                  type: 'string_format',
                  format: v,
                  outputPath: outputPath as string[],
                });

                setVWC(variableMapVWC, newVariableMap);
                setVWC(valueVWC, undefined);
              } else {
                if (variableVWC.get() !== undefined) {
                  const newVariableMap = new Map(variableMapVWC.get());
                  newVariableMap.delete(outputPrettyPath);

                  setVWC(variableMapVWC, newVariableMap);
                }
                setVWC(valueVWC, v);
              }
            }}
            label={schema.title ?? outputPath[outputPath.length - 1] ?? '(no title or path)'}
            help={
              <>
                {schema.description && <p>{schema.description}</p>}
                <RenderGuardedComponent
                  props={errorVWC}
                  component={(error) => (error === null ? <></> : <p>{error}</p>)}
                />
              </>
            }
            html5Validation={
              v.validates
                ? {
                    maxLength: schema.maxLength,
                    minLength: schema.minLength,
                    pattern: schema.pattern,
                  }
                : {}
            }
            disabled={false}
          />
        )}
        applyInstantly
      />
    </div>
  );
};

const extractParameters = (message: string): string[] => {
  // we accept curly bracket parameters and do not support any technique for escaping
  const matches = message.match(/{[^}]+}/g);
  if (matches === null) {
    return [];
  }

  return matches.map((m) => m.slice(1, -1));
};
