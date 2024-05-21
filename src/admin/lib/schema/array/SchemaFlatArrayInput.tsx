import { ReactElement, useMemo } from 'react';
import { SchemaInputProps } from '../SchemaInputProps';
import styles from './SchemaFlatArrayInput.module.css';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { WritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { Button } from '../../../../shared/forms/Button';

/**
 * Allows the user to fill out an array by adding an element to the bottom or removing
 * an arbitrary element.
 *
 * Only works if the schema is an array type with an items schema.
 *
 * Does not help with minItems, maxItems, or uniqueItems.
 */
export const SchemaFlatArrayInput = ({
  path,
  schema,
  value,
  delegator,
}: SchemaInputProps): ReactElement => {
  if (schema.type !== 'array') {
    throw new Error('SchemaFlatArrayInput only works with array schemas');
  }
  if (typeof schema.items !== 'object') {
    throw new Error('SchemaFlatArrayInput only works with array schemas with items');
  }

  const name = schema.title ?? path[path.length - 1];
  const numItemsVWC = useMappedValueWithCallbacks(value, (v) => (v as any[]).length);
  return (
    <div className={styles.container}>
      <div className={styles.meta}>
        {name && <div className={styles.title}>{name}</div>}
        {schema.description && <div className={styles.description}>{schema.description}</div>}
      </div>
      <div className={styles.items}>
        <RenderGuardedComponent
          props={numItemsVWC}
          component={(numItems) => {
            const result: ReactElement[] = [];
            for (let i = 0; i < numItems; i++) {
              result.push(
                <Item
                  key={i}
                  idx={i}
                  arrayPath={path}
                  arraySchema={schema}
                  itemSchema={schema.items}
                  arrayValue={value}
                  delegator={delegator}
                />
              );
            }
            return <>{result}</>;
          }}
        />
      </div>
      <div className={styles.addItem}>
        <Button
          type="button"
          variant="link-small"
          onClick={(e) => {
            e.preventDefault();
            const oldArrayValue = value.get();
            if (oldArrayValue === undefined) {
              return;
            }
            const newArrayValue = [...oldArrayValue];
            newArrayValue.push(
              schema.items.default ??
                schema.items.example ??
                schema.default?.[0] ??
                schema.example?.[0] ??
                undefined
            );
            value.set(newArrayValue);
            value.callbacks.call(undefined);
          }}>
          Add Item
        </Button>
      </div>
    </div>
  );
};

const Item = ({
  idx,
  arrayPath,
  arraySchema,
  itemSchema,
  arrayValue,
  delegator,
}: {
  idx: number;
  arrayPath: SchemaInputProps['path'];
  arraySchema: SchemaInputProps['schema'];
  itemSchema: SchemaInputProps['schema'];
  arrayValue: SchemaInputProps['value'];
  delegator: SchemaInputProps['delegator'];
}): ReactElement => {
  const itemValue = useMappedValueWithCallbacks(arrayValue, (v) => v?.[idx]);
  const writableItemValue = useMemo(
    (): WritableValueWithCallbacks<any> => ({
      get: itemValue.get,
      set: (v) => {
        const oldArrayValue = arrayValue.get();
        if (oldArrayValue === undefined || oldArrayValue.length <= idx) {
          return;
        }
        const newArrayValue = [...oldArrayValue];
        newArrayValue[idx] = v;
        arrayValue.set(newArrayValue);
        arrayValue.callbacks.call(undefined);
      },
      callbacks: itemValue.callbacks,
    }),
    [itemValue, arrayValue, idx]
  );

  return (
    <div className={styles.item}>
      <div className={styles.itemRemove}>
        <Button
          type="button"
          variant="link-small"
          onClick={(e) => {
            e.preventDefault();
            const oldArrayValue = arrayValue.get();
            if (oldArrayValue === undefined || oldArrayValue.length <= idx) {
              return;
            }
            const newArrayValue = [...oldArrayValue];
            newArrayValue.splice(idx, 1);
            arrayValue.set(newArrayValue);
            arrayValue.callbacks.call(undefined);
          }}>
          Remove
        </Button>
      </div>
      {delegator({
        path: [...arrayPath, idx],
        schema: itemSchema,
        value: writableItemValue,
        delegator,
      })}
    </div>
  );
};
