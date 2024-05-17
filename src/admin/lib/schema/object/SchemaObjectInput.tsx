import { ReactElement } from 'react';
import { SchemaInputProps } from '../SchemaInputProps';
import { SchemaEnumDiscriminatedObjectInput } from './SchemaEnumDiscriminatedObjectInput';
import { SchemaFlatObjectInput } from './SchemaFlatObjectInput';

/**
 * The best generic schema object input we support.
 */
export const SchemaObjectInput = (props: SchemaInputProps): ReactElement => {
  if (props.schema.type !== 'object') {
    throw new Error('SchemaObjectInput only works with object schemas');
  }
  if ('x-enum-discriminator' in props.schema) {
    return <SchemaEnumDiscriminatedObjectInput {...props} />;
  }
  return <SchemaFlatObjectInput {...props} />;
};
