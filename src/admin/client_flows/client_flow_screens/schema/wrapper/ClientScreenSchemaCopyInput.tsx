import { ReactElement, useMemo } from 'react';
import { ClientScreenSchemaInputProps } from '../ClientScreenSchemaInputProps';
import { useMappedValueWithCallbacks } from '../../../../../shared/hooks/useMappedValueWithCallbacks';
import { parsePrettySchemaPath, prettySchemaPath } from '../../../../lib/schema/prettySchemaPath';
import styles from './ClientScreenSchemaCopyInput.module.css';
import { RenderGuardedComponent } from '../../../../../shared/components/RenderGuardedComponent';
import { Checkbox } from '../../../../../shared/forms/Checkbox';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { useWritableValueWithCallbacks } from '../../../../../shared/lib/Callbacks';
import { useValuesWithCallbacksEffect } from '../../../../../shared/hooks/useValuesWithCallbacksEffect';

/**
 * Allows users to produce the value by copying from the standard, client,
 * or server parameters. If they do not, delegates
 */
export const ClientScreenSchemaCopyInput = (props: ClientScreenSchemaInputProps): ReactElement => {
  if (props.path.some((v) => typeof v !== 'string')) {
    return props.noCopyDelegator({
      schema: props.schema,
      path: props.path,
      value: props.value,
      delegator: props.withCopyDelegator,
    });
  }
  return <ClientScreenSchemaCopyInputInner {...props} />;
};

const ClientScreenSchemaCopyInputInner = ({
  schema,
  path: outputPathRaw,
  value,
  variable,
  noCopyDelegator,
  withCopyDelegator,
}: ClientScreenSchemaInputProps): ReactElement => {
  const outputPath = outputPathRaw as string[];

  const prettyOutputPath = useMemo(() => prettySchemaPath(outputPath), [outputPath]);
  const variableVWC = useMappedValueWithCallbacks(variable, (map) => map.get(prettyOutputPath), {
    inputEqualityFn: () => false,
  });
  const isCopyVWC = useMappedValueWithCallbacks(variableVWC, (value) => value?.type === 'copy');
  const inputPathVWC = useMappedValueWithCallbacks(variableVWC, (value) =>
    value?.type !== 'copy' ? undefined : value.inputPath
  );
  const inputRef = useWritableValueWithCallbacks<HTMLInputElement | null>(() => null);
  const inputPathErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);

  useValuesWithCallbacksEffect([inputPathVWC, inputRef], () => {
    const eleRaw = inputRef.get();
    if (eleRaw === null) {
      return undefined;
    }
    const ele = eleRaw;

    const canonicalInputPathRaw = inputPathVWC.get();
    if (canonicalInputPathRaw === undefined) {
      return undefined;
    }
    const canonicalInputPath = canonicalInputPathRaw;

    ele.value = prettySchemaPath(canonicalInputPath);
    ele.addEventListener('change', onChange);
    onChange();
    return () => {
      ele.removeEventListener('change', onChange);
    };

    function onChange() {
      if (value.get() !== undefined) {
        return;
      }

      const userInputPathPretty = ele.value;
      try {
        const userInputPath = parsePrettySchemaPath(userInputPathPretty);
        if (userInputPath.some((v) => typeof v !== 'string')) {
          setVWC(inputPathErrorVWC, <>Array references are not currently supported here</>);
          return;
        }

        if (userInputPath.length === 0) {
          setVWC(inputPathErrorVWC, <>Path cannot be empty</>);
        } else {
          setVWC(inputPathErrorVWC, null);
        }

        if (
          userInputPath.length !== canonicalInputPath.length ||
          userInputPath.some((v, idx) => v !== canonicalInputPath[idx])
        ) {
          const cpVariable = new Map(variable.get());
          cpVariable.set(prettyOutputPath, {
            type: 'copy',
            inputPath: userInputPath as string[],
            outputPath,
          });

          variable.set(cpVariable);
          variable.callbacks.call(undefined);
        }
      } catch (e) {
        setVWC(inputPathErrorVWC, <>Invalid path: {`${e}`}</>);
      }
    }
  });

  const name = schema.title ?? outputPath[outputPath.length - 1];
  return (
    <div className={styles.container}>
      <RenderGuardedComponent
        props={isCopyVWC}
        component={(v) => (
          <div className={styles.input}>
            <Checkbox
              label={`Copy to produce ${name}`}
              value={v}
              setValue={(v) => {
                if (v) {
                  value.set(undefined);

                  const cpVariable = new Map(variable.get());
                  cpVariable.set(prettyOutputPath, {
                    type: 'copy',
                    inputPath: ['standard', 'name', 'full'],
                    outputPath,
                  });
                  console.log('cpVariable', cpVariable);

                  variable.set(cpVariable);
                  variable.callbacks.call(undefined);
                  value.callbacks.call(undefined);
                } else {
                  value.set(schema.default ?? schema.example);
                  const cpVariable = new Map(variable.get());
                  cpVariable.delete(prettyOutputPath);
                  variable.set(cpVariable);
                  variable.callbacks.call(undefined);
                  value.callbacks.call(undefined);
                }
              }}
            />
          </div>
        )}
      />
      <RenderGuardedComponent
        props={isCopyVWC}
        component={(v) =>
          !v ? (
            noCopyDelegator({ schema, path: outputPathRaw, value, delegator: withCopyDelegator })
          ) : (
            <>
              <div className={styles.meta}>
                {name && <div className={styles.title}>{name}</div>}
                {schema.description && (
                  <div className={styles.description}>{schema.description}</div>
                )}
              </div>
              <div className={styles.inputPath}>
                <div className={styles.inputPathTitle}>Input Path:</div>
                <div className={styles.inputPathValue}>
                  <input
                    type="text"
                    defaultValue={inputPathVWC.get() ?? ''}
                    ref={(r) => setVWC(inputRef, r)}
                  />
                </div>
                <RenderGuardedComponent
                  props={inputPathErrorVWC}
                  component={(v) => <div className={styles.inputPathError}>{v}</div>}
                />
              </div>
            </>
          )
        }
      />
    </div>
  );
};
