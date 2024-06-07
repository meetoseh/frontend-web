import { ReactElement } from 'react';
import { SchemaInputProps } from '../SchemaInputProps';
import styles from './SchemaBooleanSimpleInput.module.css';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { Checkbox } from '../../../../shared/forms/Checkbox';
import { setVWC } from '../../../../shared/lib/setVWC';

/**
 * Allows the user to input a boolean value to fill in the schema.
 * Only works if the schema is a boolean type.
 *
 * Supported validation properties:
 * - `enum`
 */
export const SchemaBooleanSimpleInput = ({
  path,
  schema,
  value,
}: SchemaInputProps): ReactElement => {
  if (schema.type !== 'boolean') {
    throw new Error('SchemaNumberSimpleInput only works with number schemas');
  }

  const name = schema.title ?? path[path.length - 1];

  return (
    <div className={styles.container}>
      <RenderGuardedComponent
        props={value}
        component={(v) => (
          <Checkbox
            label={
              <>
                {name}
                {schema.description && (
                  <div className={styles.description}>{schema.description}</div>
                )}
              </>
            }
            value={v}
            setValue={(v2) => {
              setVWC(value, v2);
            }}
            disabled={schema.enum?.length === 1 && schema.enum[0] === v}
          />
        )}
        applyInstantly
      />
    </div>
  );
};
