import { WritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { SchemaInputProps } from '../../../lib/schema/SchemaInputProps';
import { ClientFlowScreenVariableInput } from '../ClientFlowScreen';

export type ClientScreenSchemaInputProps = Omit<SchemaInputProps, 'delegator'> & {
  /**
   * Maps `prettySchemaPath(path)` to the corresponding variable input, if any,
   * that fills in that path.
   */
  variable: WritableValueWithCallbacks<Map<string, ClientFlowScreenVariableInput>>;
  noCopyDelegator: SchemaInputProps['delegator'];
  withCopyDelegator: SchemaInputProps['delegator'];
};

export type ClientScreenSchemaInputPropsTopLevel = Omit<
  ClientScreenSchemaInputProps,
  'withCopyDelegator' | 'noCopyDelegator' | 'path'
> & {
  path?: (string | number)[];
  delegator?: SchemaInputProps['delegator'];
};
