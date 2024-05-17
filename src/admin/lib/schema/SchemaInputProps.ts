import { ReactElement } from 'react';
import { WritableValueWithCallbacks } from '../../../shared/lib/Callbacks';

export type SchemaInputProps = {
  /**
   * The path to the value that is being filled in. For example, if the schema
   * has type object with the properties foo, and foo is type object with
   * properties bar, and bar is type string which is the value this input is
   * filling in, then this is `["foo", "bar"]`
   */
  path: (string | number)[];

  /**
   * The openapi 3.0.3 schema object which defines what an acceptable value is
   * at this path
   */
  schema: any;

  /**
   * The value that is currently filled in at this path. This object may
   * write to this value as the user inputs data.
   */
  value: WritableValueWithCallbacks<any>;

  /**
   * The component to use when there are subschemas that need to be filled in.
   */
  delegator: (props: SchemaInputProps) => ReactElement;
};

export type SchemaInputPropsTopLevel = Omit<SchemaInputProps, 'delegator' | 'path'> & {
  path?: (string | number)[];
  delegator?: SchemaInputProps['delegator'];
};
