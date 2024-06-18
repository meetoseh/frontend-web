import { Fragment, ReactElement, useMemo } from 'react';
import styles from '../../../../lib/schema/object/SchemaFlatObjectInput.module.css';
import { ClientScreenSchemaInputProps } from '../ClientScreenSchemaInputProps';
import { useMappedValuesWithCallbacks } from '../../../../../shared/hooks/useMappedValuesWithCallbacks';
import { prettySchemaPath } from '../../../../lib/schema/prettySchemaPath';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { RenderGuardedComponent } from '../../../../../shared/components/RenderGuardedComponent';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { useMappedValueWithCallbacks } from '../../../../../shared/hooks/useMappedValueWithCallbacks';
import { Checkbox } from '../../../../../shared/forms/Checkbox';
import { CrudSwappableElement } from '../../../../lib/CrudSwappableElement';

/**
 * Allows the user to fill out an object by filling out each of its properties
 * via the delegator. This is almost identical to the standard SchemaFlatObjectInput,
 * except it detects when one of the properties is specified via `variable` and still
 * shows it as checked.
 *
 * Only works if the schema is an object type with properties, i.e., doesn't have
 * anyOf, allOf, oneOf, or additionalProperties.
 *
 * Doesn't provide any help with `not`, `minProperties`, or `maxProperties`.
 *
 * Does support `required`
 */
export const ClientScreenSchemaFlatObjectInput = ({
  path,
  schema,
  value,
  variable,
  withCopyDelegator: delegator,
  rootValue,
  rootSchema,
}: ClientScreenSchemaInputProps): ReactElement => {
  if (schema.type !== 'object') {
    throw new Error('SchemaObjectInput only works with object schemas');
  }
  if (typeof schema.properties !== 'object') {
    throw new Error('SchemaObjectInput only works with object schemas with properties');
  }

  if (typeof value?.get !== 'function') {
    throw new Error('bad value here');
  }
  const isNullAndNullableVWC = useMappedValueWithCallbacks(
    value,
    (v) => !!(v === null && schema.nullable),
    { inputEqualityFn: () => false }
  );

  const properties = useMemo((): Map<string, { required: boolean; schema: any }> => {
    const result = new Map<string, { required: boolean; schema: any }>();
    const required = new Set<string>(schema.required ?? []);
    for (const [prop, propSchema] of Object.entries(schema.properties)) {
      result.set(prop, { required: required.has(prop), schema: propSchema });
    }
    return result;
  }, [schema.required, schema.properties]);
  const haveOptionalProperties = useMemo(
    () => Array.from(properties.values()).some((v) => !v.required),
    [properties]
  );

  const includingPropertiesVWC = useMappedValuesWithCallbacks(
    [value, variable],
    () => {
      const result = new Set<string>();
      const fixed = value.get() ?? {};
      const variableMap = variable.get();
      for (const [prop, { required }] of Array.from(properties.entries())) {
        if (required || prop in fixed) {
          result.add(prop);
          continue;
        }

        const variableValue = variableMap.get(prettySchemaPath(path.concat(prop)));
        if (variableValue !== undefined) {
          result.add(prop);
        }
      }
      return result;
    },
    {
      outputEqualityFn: (a, b) => a.size === b.size && Array.from(a).every((v) => b.has(v)),
    }
  );

  const name = schema.title ?? path[path.length - 1];

  return (
    <div className={styles.container}>
      <div className={styles.meta}>
        {name && <div className={styles.title}>{name}</div>}
        {schema.description && <div className={styles.description}>{schema.description}</div>}
      </div>
      {!!schema.nullable && (
        <div className={styles.nullable}>
          <RenderGuardedComponent
            props={isNullAndNullableVWC}
            component={(isNull) => (
              <Checkbox
                label="Null"
                value={isNull}
                setValue={(v) => {
                  if (v) {
                    setVWC(value, null);
                  } else {
                    setVWC(value, schema.example ?? schema.default ?? {});
                  }
                }}
              />
            )}
          />
        </div>
      )}

      <CrudSwappableElement
        version={isNullAndNullableVWC}
        truthy={() => <></>}
        falsey={() => (
          <>
            {!haveOptionalProperties ? null : (
              <div className={styles.optionalProperties}>
                {Array.from(properties.entries()).map(([prop, { required }]) => (
                  <IncludedCheckbox
                    key={prop}
                    prop={prop}
                    required={required}
                    includedPropertiesVWC={includingPropertiesVWC}
                    setValue={(v) => {
                      if (v) {
                        const newValue = { ...value.get() };
                        const p = properties.get(prop);
                        if (p === undefined) {
                          console.warn('tried to include a property that does not exist', prop);
                          return;
                        }
                        newValue[prop] = p.schema.default;
                        setVWC(value, newValue);
                      } else {
                        const fixed = value.get();
                        if (prop in fixed) {
                          const newValue = { ...fixed };
                          delete newValue[prop];
                          setVWC(value, newValue);
                          return;
                        }

                        const newVariableMap = new Map(variable.get());
                        newVariableMap.delete(prettySchemaPath(path.concat(prop)));
                        setVWC(variable, newVariableMap);
                      }
                    }}
                  />
                ))}
              </div>
            )}
            <div className={styles.properties}>
              <RenderGuardedComponent
                props={includingPropertiesVWC}
                component={(includedSet) => {
                  const included = Array.from(includedSet);
                  included.sort();

                  const parts: ReactElement[] = [];
                  included.forEach((prop) => {
                    const propInfo = properties.get(prop);
                    if (propInfo === undefined) {
                      return;
                    }
                    const vwc: WritableValueWithCallbacks<any> = {
                      get: () => value.get()?.[prop],
                      set: (v) => {
                        const newValue = { ...value.get() };
                        newValue[prop] = v;
                        setVWC(value, newValue);
                      },
                      callbacks: value.callbacks,
                    };

                    parts.push(
                      <Fragment key={prop}>
                        {delegator({
                          value: vwc,
                          path: [...path, prop],
                          schema: propInfo.schema,
                          delegator,
                          rootValue,
                          rootSchema,
                        })}
                      </Fragment>
                    );
                  });

                  return <>{parts}</>;
                }}
              />
            </div>
          </>
        )}
      />
    </div>
  );
};

const IncludedCheckbox = ({
  prop,
  required,
  includedPropertiesVWC,
  setValue,
}: {
  prop: string;
  required: boolean;
  includedPropertiesVWC: ValueWithCallbacks<Set<string>>;
  setValue: (v: boolean) => void;
}): ReactElement => {
  const checkedVWC = useMappedValueWithCallbacks(includedPropertiesVWC, (v) => v.has(prop));
  return (
    <RenderGuardedComponent
      props={checkedVWC}
      component={(checked) => (
        <Checkbox value={checked} setValue={setValue} label={prop} disabled={required} />
      )}
    />
  );
};
