import { ReactElement, useMemo } from 'react';
import { TouchPointSchemaInputProps } from '../TouchPointSchemaInputProps';
import { prettySchemaPath } from '../../../lib/schema/prettySchemaPath';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import styles from './TouchPointSchemaStringInput.module.css';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { TextInput } from '../../../../shared/forms/TextInput';
import { setVWC } from '../../../../shared/lib/setVWC';

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
export const TouchPointSchemaStringInput = ({
  path: outputPath,
  schema,
  value: valueVWC,
  variable: variableMapVWC,
}: TouchPointSchemaInputProps): ReactElement => {
  if (schema.type !== 'string') {
    throw new Error('TouchPointSchemaStringInput only works with string schemas');
  }
  const outputPrettyPath = useMemo(() => prettySchemaPath(outputPath), [outputPath]);
  const variableVWC = useMappedValueWithCallbacks(variableMapVWC, (v) => v.get(outputPrettyPath));
  const isVariableVWC = useMappedValueWithCallbacks(variableVWC, (v) => v !== undefined);
  const textVWC = useMappedValuesWithCallbacks([variableVWC, valueVWC], (): string | undefined => {
    const valueAsVariable = variableVWC.get();
    if (valueAsVariable !== undefined) {
      return valueAsVariable.format;
    }

    const value = valueVWC.get();
    if (value === null || value === undefined || typeof value !== 'string') {
      return undefined;
    }

    return value;
  });
  const errorVWC = useMappedValuesWithCallbacks(
    [textVWC, variableVWC],
    () => {
      const text = textVWC.get();
      const variably = variableVWC.get();

      if (text === undefined) {
        return <>Not currently set. Make any edit to override.</>;
      }

      const params = extractParameters(text);
      if (params.length > 0) {
        if (variably === undefined) {
          return <>This should be using a variable input (admin area error?)</>;
        }
        if (
          params.length !== variably.parameters.length ||
          params.some((p) => !variably.parameters.includes(p))
        ) {
          return (
            <>
              The string format parameters don't match the requested paramaters (make any edit to
              fix)
            </>
          );
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
              const params = extractParameters(v);
              if (params.length > 0) {
                const newVariableMap = new Map(variableMapVWC.get());
                newVariableMap.set(outputPrettyPath, {
                  format: v,
                  key: outputPath as string[],
                  parameters: params,
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

  return matches.map((m) => m.slice(1, -1)).map((m) => pythonToDot(m));
};

/**
 * Converts a python style parameter reference foo[bar][baz] to
 * dots foo.bar.baz
 */
const pythonToDot = (pyParam: string): string => {
  return pyParam.replace(/\[/g, '.').replace(/\]/g, '');
};
