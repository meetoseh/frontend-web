import { ReactElement, useMemo } from 'react';
import styles from './SchemaEnumDiscriminatedObjectInput.module.css';
import { SchemaInputProps } from '../SchemaInputProps';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';

/**
 * For an object schema with no properties, an `x-enum-discriminator` property,
 * and `oneOf` set, where each of the oneOfs is also type object,
 * x-enum-discriminator is a string that corresponds to a required string
 * property on each of the oneOfs with a single, unique enum value allowed, this
 * input allows the user to select which of the oneOfs to fill in by selecting
 * the enum value, then delegates that.
 */
export const SchemaEnumDiscriminatedObjectInput = ({
  schema,
  value,
  path,
  delegator,
  rootValue,
  rootSchema,
}: SchemaInputProps): ReactElement => {
  if (schema.type !== 'object') {
    throw new Error('SchemaEnumDiscriminatedObjectInput only works with object schemas');
  }
  const discriminatorRaw = schema['x-enum-discriminator'];
  if (typeof discriminatorRaw !== 'string') {
    throw new Error('SchemaEnumDiscriminatedObjectInput requires x-enum-discriminator');
  }
  const discriminator = discriminatorRaw;

  const oneOfRaw = schema.oneOf;
  if (!Array.isArray(oneOfRaw)) {
    throw new Error('SchemaEnumDiscriminatedObjectInput requires oneOf');
  }
  const oneOf = oneOfRaw;

  const orderedOptions = useMemo(() => {
    const result: string[] = [];
    const resultSet = new Set<string>();
    for (let i = 0; i < oneOf.length; i++) {
      if (typeof oneOf[i] !== 'object') {
        throw new Error('SchemaEnumDiscriminatedObjectInput requires oneOf to be objects');
      }
      const oneOfSchema = oneOf[i];
      if (oneOfSchema.type !== 'object') {
        throw new Error('SchemaEnumDiscriminatedObjectInput requires oneOf to be type objects');
      }
      const discriminatorValueSchema = oneOfSchema.properties?.[discriminator];
      if (typeof discriminatorValueSchema !== 'object') {
        throw new Error('SchemaEnumDiscriminatedObjectInput requires discriminator property');
      }
      if (discriminatorValueSchema.type !== 'string') {
        throw new Error(
          'SchemaEnumDiscriminatedObjectInput requires discriminator property to be string'
        );
      }
      if (!Array.isArray(discriminatorValueSchema.enum)) {
        throw new Error(
          'SchemaEnumDiscriminatedObjectInput requires discriminator property to have enum'
        );
      }
      if (discriminatorValueSchema.enum.length !== 1) {
        throw new Error(
          'SchemaEnumDiscriminatedObjectInput requires discriminator property to have single enum value'
        );
      }
      const enumValue = discriminatorValueSchema.enum[0];
      if (resultSet.has(enumValue)) {
        throw new Error('SchemaEnumDiscriminatedObjectInput requires unique enum values');
      }
      result.push(enumValue);
      resultSet.add(enumValue);
    }
    return result;
  }, [oneOf, discriminator]);

  const choiceVWC = useMappedValueWithCallbacks(value, (v) => {
    if (v === undefined || v === null) {
      return orderedOptions[0];
    }

    if (typeof v !== 'object') {
      return orderedOptions[0];
    }

    if (!v.hasOwnProperty(discriminator)) {
      return orderedOptions[0];
    }

    return v[discriminator];
  });
  const choiceErrorVWC = useMappedValuesWithCallbacks([value, choiceVWC], () => {
    const v = value.get();
    if (v === undefined || v === null) {
      return <>This value is not actually stored. Change it to update.</>;
    }
    if (typeof v !== 'object') {
      return (
        <>This value is not actually stored. The stored value is invalid. Change it to update.</>
      );
    }
    if (!v.hasOwnProperty(discriminator)) {
      return (
        <>
          This value is not actually stored. The stored value is missing the discriminator. Change
          it to update.
        </>
      );
    }
    const stored = v[discriminator];
    if (stored !== choiceVWC.get()) {
      return (
        <>
          This value is not actually stored The stored value is {`${value.get()}`}. Change it to
          update.
        </>
      );
    }
    if (!orderedOptions.includes(stored)) {
      return <>This value is not one of the options. Change it to update.</>;
    }
    return undefined;
  });
  const choiceIndexVWC = useMappedValueWithCallbacks(choiceVWC, (choice) =>
    orderedOptions.indexOf(choice)
  );
  const name = schema.title ?? path[path.length - 1];

  const cleanedOneOf = oneOf.map((oneOfSchema) => {
    const result = { ...oneOfSchema };
    result.required = [...result.required];
    delete result.description;
    result.title = 'Additional Parameters';
    const requiredIdx = result.required.indexOf(discriminator);
    if (requiredIdx !== -1) {
      result.required.splice(requiredIdx, 1);
    }
    result.properties = { ...result.properties };
    delete result.properties[discriminator];
    return result;
  });

  return (
    <div className={styles.container}>
      <div className={styles.meta}>
        {name && <div className={styles.title}>{name}</div>}
        {schema.description && <div className={styles.description}>{schema.description}</div>}
      </div>
      <div className={styles.selectContainer}>
        <div className={styles.selectTitle}>
          <RenderGuardedComponent
            props={choiceIndexVWC}
            component={(choiceIndex) => (
              <>
                {schema.oneOf[choiceIndex >= 0 ? choiceIndex : 0].properties[discriminator].title ??
                  discriminator}
              </>
            )}
          />
        </div>
        <RenderGuardedComponent
          props={choiceVWC}
          component={(choice) => (
            <select
              value={choice}
              className={styles.select}
              onChange={(e) => {
                const newChoice = e.target.value;
                const newValueIdx = orderedOptions.indexOf(newChoice);
                const newValue = oneOf[newValueIdx].example ?? {
                  [discriminator]: newChoice,
                };
                setVWC(value, newValue);
              }}>
              {orderedOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          )}
          applyInstantly
        />
        <RenderGuardedComponent
          props={choiceErrorVWC}
          component={(error) =>
            error === undefined ? <></> : <div className={styles.selectError}>{error}</div>
          }
        />
        <RenderGuardedComponent
          props={choiceIndexVWC}
          component={(choiceIndex) => (
            <div className={styles.selectDescription}>
              {choiceIndex === -1 ? <></> : schema.oneOf[choiceIndex].description ?? ''}
            </div>
          )}
        />
      </div>

      <RenderGuardedComponent
        props={choiceIndexVWC}
        component={(choiceIndex) =>
          choiceIndex === -1 ? (
            <></>
          ) : (
            delegator({
              schema: cleanedOneOf[choiceIndex],
              value: value,
              path: path,
              delegator: delegator,
              rootValue,
              rootSchema,
            })
          )
        }
        applyInstantly
      />
    </div>
  );
};
