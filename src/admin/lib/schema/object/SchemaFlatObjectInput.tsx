import { Fragment, ReactElement, useMemo } from 'react';
import { SchemaInputProps } from '../SchemaInputProps';
import { ValueWithCallbacks, WritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import styles from './SchemaFlatObjectInput.module.css';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { Checkbox } from '../../../../shared/forms/Checkbox';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { setVWC } from '../../../../shared/lib/setVWC';

/**
 * Allows the user to fill out an object by filling out each of its properties
 * via the delegator.
 *
 * Only works if the schema is an object type with properties, i.e., doesn't have
 * anyOf, allOf, oneOf, or additionalProperties.
 *
 * Doesn't provide any help with `not`, `minProperties`, or `maxProperties`.
 *
 * Does support `required`
 */
export const SchemaFlatObjectInput = ({
  path,
  schema,
  value,
  delegator,
  rootValue,
  rootSchema,
}: SchemaInputProps): ReactElement => {
  if (schema.type !== 'object') {
    throw new Error('SchemaObjectInput only works with object schemas');
  }
  if (typeof schema.properties !== 'object') {
    throw new Error('SchemaObjectInput only works with object schemas with properties');
  }

  if (typeof value?.get !== 'function') {
    throw new Error('bad value here');
  }

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

  const includingPropertiesVWC = useMappedValueWithCallbacks(
    value,
    (v) => {
      const result = new Set<string>();
      for (const [prop, { required }] of Array.from(properties.entries())) {
        if (required || (v !== undefined && v !== null && typeof v === 'object' && prop in v)) {
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
                  const newValue = { ...value.get() };
                  delete newValue[prop];
                  setVWC(value, newValue);
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
