import { ReactElement } from 'react';
import {
  ClientScreenSchemaInputProps,
  ClientScreenSchemaInputPropsTopLevel,
} from '../ClientScreenSchemaInputProps';
import { ClientScreenSchemaCopyInput } from '../wrapper/ClientScreenSchemaCopyInput';
import { SchemaStandard } from '../../../../lib/schema/multiple/SchemaStandard';
import { ClientScreenSchemaStringInput } from '../string/ClientScreenSchemaStringInput';

const copyableTypes = new Set(['number', 'integer', 'boolean', 'double', 'float']);

/**
 * Fills in the values for a client screen schema, as would be done when
 * editing a client flow screen
 */
export const ClientScreenSchema = ({
  schema,
  path,
  value,
  delegator,
  variable,
  noCopy,
}: ClientScreenSchemaInputPropsTopLevel & { noCopy?: boolean }): ReactElement => {
  const subprops = {
    schema,
    path: path ?? [],
    value,
    variable,
  };

  const fancyProps: ClientScreenSchemaInputProps = {
    ...subprops,
    noCopyDelegator: (props) => <ClientScreenSchema variable={variable} {...props} noCopy={true} />,
    withCopyDelegator: (props) => (
      <ClientScreenSchema variable={variable} {...props} noCopy={false} />
    ),
  };

  if (!noCopy && copyableTypes.has(schema.type)) {
    return <ClientScreenSchemaCopyInput {...fancyProps} />;
  }

  if (schema.type === 'string') {
    return <ClientScreenSchemaStringInput {...fancyProps} />;
  }

  return (
    <SchemaStandard
      {...subprops}
      delegator={(props) => <ClientScreenSchema variable={variable} {...props} noCopy={false} />}
    />
  );
};
