import { ReactElement } from 'react';
import { SchemaInputProps, SchemaInputPropsTopLevel } from '../SchemaInputProps';
import { SchemaStringSimpleInput } from '../string/SchemaStringSimpleInput';
import { SchemaRawInput } from '../wrapper/SchemaRawInput';
import { SchemaObjectInput } from '../object/SchemaObjectInput';

/**
 * A very simple openapi 3.0.3 schema editor that only supports objects and
 * string leafs before delegating to a raw editor.
 */
export const SchemaSimpleStrings = ({
  schema,
  path,
  value,
  delegator,
}: SchemaInputPropsTopLevel): ReactElement => {
  const subprops: SchemaInputProps = {
    schema,
    path: path ?? [],
    value,
    delegator: delegator ?? ((props) => <SchemaSimpleStrings {...props} />),
  };

  if (schema.type === 'object') {
    return <SchemaObjectInput {...subprops} />;
  } else if (schema.type === 'string') {
    return <SchemaStringSimpleInput {...subprops} />;
  } else {
    return <SchemaRawInput {...subprops} />;
  }
};
