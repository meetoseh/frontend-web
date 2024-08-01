import { ReactElement } from 'react';
import { SchemaInputProps, SchemaInputPropsTopLevel } from '../SchemaInputProps';
import { SchemaStringSimpleInput } from '../string/SchemaStringSimpleInput';
import { SchemaRawInput } from '../wrapper/SchemaRawInput';
import { SchemaObjectInput } from '../object/SchemaObjectInput';
import { SchemaNumberSimpleInput } from '../number/SchemaNumberSimpleInput';
import { SchemaFlatArrayInput } from '../array/SchemaFlatArrayInput';
import { SchemaBooleanSimpleInput } from '../boolean/SchemaBooleanSimpleInput';

/**
 * A very simple openapi 3.0.3 schema editor that supports as much of the
 * standard openapi 3.0.3 stuff as possible before delegating to a raw editor.
 */
export const SchemaStandard = ({
  schema,
  path,
  value,
  delegator,
  rootValue,
  rootSchema,
}: SchemaInputPropsTopLevel): ReactElement => {
  const subprops: SchemaInputProps = {
    schema,
    path: path ?? [],
    value,
    delegator: delegator ?? ((props) => <SchemaStandard {...props} />),
    rootValue: rootValue ?? value,
    rootSchema: rootSchema ?? schema,
  };

  if (schema.type === 'object') {
    if (schema.properties === undefined && !('x-enum-discriminator' in schema)) {
      return <SchemaRawInput {...subprops} />;
    }
    return <SchemaObjectInput {...subprops} />;
  } else if (schema.type === 'array') {
    return <SchemaFlatArrayInput {...subprops} />;
  } else if (schema.type === 'string') {
    return <SchemaStringSimpleInput {...subprops} />;
  } else if (
    schema.type === 'number' ||
    schema.type === 'integer' ||
    schema.type === 'float' ||
    schema.type === 'double'
  ) {
    return <SchemaNumberSimpleInput {...subprops} />;
  } else if (schema.type === 'boolean') {
    return <SchemaBooleanSimpleInput {...subprops} />;
  } else {
    return <SchemaRawInput {...subprops} />;
  }
};
