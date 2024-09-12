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
import { VerticalSpacer } from '../../../../../shared/components/VerticalSpacer';

/**
 * Allows users to produce the value by copying from the standard, client,
 * or server parameters. If they do not, delegates
 */
export const ClientScreenSchemaCopyInput = (props: ClientScreenSchemaInputProps): ReactElement => {
  if (props.schema.deprecated) {
    return <Deprecated {...props} />;
  }

  if (typeof props.path[props.path.length - 1] !== 'string') {
    return props.noCopyDelegator({
      schema: props.schema,
      path: props.path,
      value: props.value,
      delegator: props.withCopyDelegator,
      rootValue: props.rootValue,
      rootSchema: props.rootSchema,
    });
  }
  return <ClientScreenSchemaCopyInputInner {...props} />;
};

const Deprecated = (props: ClientScreenSchemaInputProps): ReactElement => {
  const copySchema = { ...props.schema };
  delete copySchema.deprecated;

  return (
    <div className={styles.deprecated}>
      <div className={styles.deprecatedMessage}>
        This property is deprecated. Generally, that means it only effects old clients.
      </div>
      <VerticalSpacer height={8} />
      <ClientScreenSchemaCopyInput {...props} schema={copySchema} />
    </div>
  );
};

const ClientScreenSchemaCopyInputInner = ({
  schema,
  path: outputPathRaw,
  value,
  variable,
  noCopyDelegator,
  withCopyDelegator,
  rootValue,
  rootSchema,
}: ClientScreenSchemaInputProps): ReactElement => {
  const outputPath = outputPathRaw as string[];

  const prettyOutputPath = useMemo(() => prettySchemaPath(outputPath), [outputPath]);
  const variableVWC = useMappedValueWithCallbacks(variable, (map) => map.get(prettyOutputPath), {
    inputEqualityFn: () => false,
  });
  const variableTypeVWC = useMappedValueWithCallbacks(variableVWC, (value) => value?.type);
  const isCopyVWC = useMappedValueWithCallbacks(
    variableTypeVWC,
    (type) => type === 'copy' || type === 'extract'
  );
  const extractingVWC = useMappedValueWithCallbacks(
    variableVWC,
    (value) => value?.type === 'extract'
  );
  const skipIfMissingVWC = useMappedValueWithCallbacks(
    variableVWC,
    (value) => value?.type === 'extract' && value.skipIfMissing
  );
  const inputPathVWC = useMappedValueWithCallbacks(variableVWC, (value) => {
    if (value === undefined) {
      return [];
    }
    if (value.type === 'copy' || value.type === 'extract') {
      return value.inputPath;
    }
    return [];
  });
  const inputRef = useWritableValueWithCallbacks<HTMLInputElement | null>(() => null);
  const inputPathErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);

  const extractPathVWC = useMappedValueWithCallbacks(variableVWC, (value) => {
    if (value === undefined) {
      return [];
    }
    if (value.type === 'extract') {
      return value.extractedPath;
    }
    return [];
  });
  const extractRef = useWritableValueWithCallbacks<HTMLInputElement | null>(() => null);
  const extractPathErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);

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
          cpVariable.set(
            prettyOutputPath,
            !extractingVWC.get()
              ? {
                  type: 'copy',
                  inputPath: userInputPath as string[],
                  outputPath,
                }
              : {
                  type: 'extract',
                  inputPath: userInputPath as string[],
                  extractedPath: extractPathVWC.get(),
                  outputPath,
                  skipIfMissing: skipIfMissingVWC.get(),
                }
          );

          variable.set(cpVariable);
          variable.callbacks.call(undefined);
        }
      } catch (e) {
        setVWC(inputPathErrorVWC, <>Invalid path: {`${e}`}</>);
      }
    }
  });

  useValuesWithCallbacksEffect([extractPathVWC, extractRef], () => {
    const eleRaw = extractRef.get();
    if (eleRaw === null) {
      return undefined;
    }
    const ele = eleRaw;

    const canonicalExtractPathRaw = extractPathVWC.get();
    if (canonicalExtractPathRaw === undefined) {
      return undefined;
    }
    const canonicalExtractPath = canonicalExtractPathRaw;

    ele.value = prettySchemaPath(canonicalExtractPath);
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
          setVWC(extractPathErrorVWC, <>Array references are not currently supported here</>);
          return;
        }

        if (userInputPath.length === 0) {
          setVWC(extractPathErrorVWC, <>Path cannot be empty</>);
        } else {
          setVWC(extractPathErrorVWC, null);
        }

        if (
          userInputPath.length !== canonicalExtractPath.length ||
          userInputPath.some((v, idx) => v !== canonicalExtractPath[idx])
        ) {
          const cpVariable = new Map(variable.get());
          cpVariable.set(prettyOutputPath, {
            type: 'extract',
            inputPath: inputPathVWC.get(),
            extractedPath: userInputPath as string[],
            outputPath,
            skipIfMissing: skipIfMissingVWC.get(),
          });

          variable.set(cpVariable);
          variable.callbacks.call(undefined);
        }
      } catch (e) {
        setVWC(extractPathErrorVWC, <>Invalid path: {`${e}`}</>);
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
              label={`Copy or extract to produce ${name}`}
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
            noCopyDelegator({
              schema,
              path: outputPathRaw,
              value,
              delegator: withCopyDelegator,
              rootValue,
              rootSchema,
            })
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
              <div className={styles.extract}>
                <RenderGuardedComponent
                  props={extractingVWC}
                  component={(extracting) => (
                    <>
                      <Checkbox
                        label="Extract"
                        value={extracting}
                        setValue={(v) => {
                          if (v) {
                            const cpVariable = new Map(variable.get());
                            cpVariable.set(prettyOutputPath, {
                              type: 'extract',
                              inputPath: inputPathVWC.get(),
                              extractedPath: ['uid'],
                              outputPath,
                              skipIfMissing: false,
                            });
                            variable.set(cpVariable);
                            variable.callbacks.call(undefined);
                          } else {
                            const cpVariable = new Map(variable.get());
                            cpVariable.set(prettyOutputPath, {
                              type: 'copy',
                              inputPath: inputPathVWC.get(),
                              outputPath,
                            });
                            variable.set(cpVariable);
                            variable.callbacks.call(undefined);
                          }
                        }}
                      />
                      {extracting && (
                        <>
                          <div className={styles.inputPathTitle}>Extract Path:</div>
                          <div className={styles.inputPathValue}>
                            <input
                              type="text"
                              defaultValue={extractPathVWC.get() ?? ''}
                              ref={(r) => setVWC(extractRef, r)}
                            />
                          </div>
                          <RenderGuardedComponent
                            props={extractPathErrorVWC}
                            component={(v) => <div className={styles.inputPathError}>{v}</div>}
                          />
                          <RenderGuardedComponent
                            props={skipIfMissingVWC}
                            component={(v) => (
                              <Checkbox
                                label="Dont enqueue screen if value is unavailable"
                                value={v}
                                setValue={(v) => {
                                  const cpVariable = new Map(variable.get());
                                  cpVariable.set(prettyOutputPath, {
                                    type: 'extract',
                                    inputPath: inputPathVWC.get(),
                                    extractedPath: extractPathVWC.get(),
                                    outputPath,
                                    skipIfMissing: v,
                                  });
                                  variable.set(cpVariable);
                                  variable.callbacks.call(undefined);
                                }}
                              />
                            )}
                          />
                        </>
                      )}
                    </>
                  )}
                />
              </div>
            </>
          )
        }
      />
    </div>
  );
};
