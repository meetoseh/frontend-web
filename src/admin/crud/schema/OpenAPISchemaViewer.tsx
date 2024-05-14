import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { ValueWithCallbacks } from '../../../shared/lib/Callbacks';
import styles from './OpenAPISchemaViewer.module.css';

export type OpenAPISchemaViewerProps = {
  /**
   * The schema to display.
   */
  schema: ValueWithCallbacks<{ parsed: unknown; source: string }>;
};

/**
 * Renders an OpenAPI 3.0.3 schema object.
 */
export const OpenAPISchemaViewer = ({ schema }: OpenAPISchemaViewerProps) => {
  const sourceVWC = useMappedValueWithCallbacks(schema, ({ source }) => source);
  return (
    <div className={styles.container}>
      <RenderGuardedComponent props={sourceVWC} component={(s) => <pre>{s}</pre>} />
    </div>
  );
};
