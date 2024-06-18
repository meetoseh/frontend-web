import { ReactElement } from 'react';
import {
  ClientScreenSchemaInputProps,
  ClientScreenSchemaInputPropsTopLevel,
} from '../ClientScreenSchemaInputProps';
import { ClientScreenSchemaCopyInput } from '../wrapper/ClientScreenSchemaCopyInput';
import { SchemaStandard } from '../../../../lib/schema/multiple/SchemaStandard';
import { ClientScreenSchemaStringInput } from '../string/ClientScreenSchemaStringInput';
import { ClientScreenSchemaImageInput } from '../string/ClientScreenSchemaImageInput';
import { ClientScreenSchemaContentInput } from '../string/ClientScreenSchemaContentInput';
import { ClientScreenSchemaFlowSlugInput } from '../string/ClientScreenSchemaFlowSlugInput';
import { ClientScreenSchemaFlatObjectInput } from '../object/ClientScreenSchemaFlatObjectInput';

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
  imageHandler,
  rootValue,
  rootSchema,
}: ClientScreenSchemaInputPropsTopLevel & { noCopy?: boolean }): ReactElement => {
  const subprops = {
    schema,
    path: path ?? [],
    value,
    variable,
    imageHandler,
    rootValue: rootValue ?? value,
    rootSchema: rootSchema ?? schema,
  };

  const fancyProps: ClientScreenSchemaInputProps = {
    ...subprops,
    noCopyDelegator: (props) => (
      <ClientScreenSchema
        variable={variable}
        imageHandler={imageHandler}
        {...props}
        noCopy={true}
      />
    ),
    withCopyDelegator: (props) => (
      <ClientScreenSchema
        variable={variable}
        imageHandler={imageHandler}
        {...props}
        noCopy={false}
      />
    ),
  };

  if (!noCopy) {
    return <ClientScreenSchemaCopyInput {...fancyProps} />;
  }

  if (schema.type === 'string') {
    if (schema.format === 'image_uid') {
      return <ClientScreenSchemaImageInput {...fancyProps} />;
    } else if (schema.format === 'content_uid') {
      return <ClientScreenSchemaContentInput {...fancyProps} />;
    } else if (schema.format === 'flow_slug') {
      return <ClientScreenSchemaFlowSlugInput {...fancyProps} />;
    }
    return <ClientScreenSchemaStringInput {...fancyProps} />;
  }

  if (
    schema.type === 'object' &&
    schema.format === undefined &&
    !('x-enum-discriminator' in schema)
  ) {
    return <ClientScreenSchemaFlatObjectInput {...fancyProps} />;
  }

  return (
    <SchemaStandard
      {...subprops}
      delegator={(props) => (
        <ClientScreenSchema
          variable={variable}
          imageHandler={imageHandler}
          {...props}
          noCopy={false}
        />
      )}
    />
  );
};
