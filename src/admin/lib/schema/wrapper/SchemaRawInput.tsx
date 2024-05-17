import { setVWC } from '../../../../shared/lib/setVWC';
import { RawJSONEditor } from '../RawJSONEditor';
import { SchemaInputPropsTopLevel } from '../SchemaInputProps';
import styles from './SchemaRawInput.module.css';

/**
 * Allows the user to input a value matching the given schema by entering the
 * corresponding json value. Provides title, description, and the raw schema
 * they need to match.
 */
export const SchemaRawInput = ({ schema, path, value }: SchemaInputPropsTopLevel) => {
  const name = schema.title ?? path?.[path.length - 1];

  const minimalSchema = { ...schema };
  delete minimalSchema.title;
  delete minimalSchema.description;
  delete minimalSchema.example;
  delete minimalSchema.default;

  return (
    <div className={styles.container}>
      <div className={styles.meta}>
        {name && <div className={styles.title}>{name}</div>}
        {schema.description && <div className={styles.description}>{schema.description}</div>}
        <div className={styles.schema}>
          <div className={styles.schemaTitle}>Schema you must match:</div>
          <pre className={styles.schemaPre}>{JSON.stringify(minimalSchema, null, 2)}</pre>
        </div>
      </div>
      <RawJSONEditor canonicalVWC={value} setValue={(v) => setVWC(value, v)} rows={1} />
    </div>
  );
};
