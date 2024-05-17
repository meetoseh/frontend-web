import { ReactElement } from 'react';
import { SchemaInputProps, SchemaInputPropsTopLevel } from '../SchemaInputProps';
import { SchemaStringSimpleInput } from '../string/SchemaStringSimpleInput';
import { SchemaRawInput } from '../wrapper/SchemaRawInput';
import { SchemaObjectInput } from '../object/SchemaObjectInput';
import { SchemaNumberSimpleInput } from '../number/SchemaNumberSimpleInput';

/**
 * A very simple openapi 3.0.3 schema editor that supports as much of the
 * standard openapi 3.0.3 stuff as possible before delegating to a raw editor.
 */
export const SchemaStandard = ({
  schema,
  path,
  value,
  delegator,
}: SchemaInputPropsTopLevel): ReactElement => {
  const subprops: SchemaInputProps = {
    schema,
    path: path ?? [],
    value,
    delegator: delegator ?? ((props) => <SchemaStandard {...props} />),
  };

  if (schema.type === 'object') {
    return <SchemaObjectInput {...subprops} />;
  } else if (schema.type === 'string') {
    return <SchemaStringSimpleInput {...subprops} />;
  } else if (
    schema.type === 'number' ||
    schema.type === 'integer' ||
    schema.type === 'float' ||
    schema.type === 'double'
  ) {
    return <SchemaNumberSimpleInput {...subprops} />;
  } else {
    return <SchemaRawInput {...subprops} />;
  }
};
