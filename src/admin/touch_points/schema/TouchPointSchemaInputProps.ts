import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { WritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { SchemaInputProps } from '../../lib/schema/SchemaInputProps';
import { TouchPointTemplateParameterSubstitution } from '../TouchPoint';

export type TouchPointSchemaInputProps = Omit<SchemaInputProps, 'delegator'> & {
  /**
   * Maps `prettySchemaPath(path)` to the corresponding variable input, if any,
   * that fills in that path.
   */
  variable: WritableValueWithCallbacks<Map<string, TouchPointTemplateParameterSubstitution>>;
  imageHandler: OsehImageStateRequestHandler;
};

export type TouchPointSchemaInputPropsTopLevel = Omit<
  TouchPointSchemaInputProps,
  'delegator' | 'path' | 'rootValue' | 'rootSchema'
> & {
  path?: (string | number)[];
  delegator?: SchemaInputProps['delegator'];
  rootValue?: WritableValueWithCallbacks<any>;
  rootSchema?: any;
};
