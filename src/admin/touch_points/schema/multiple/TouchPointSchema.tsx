import { ReactElement } from 'react';
import { TouchPointSchemaInputPropsTopLevel } from '../TouchPointSchemaInputProps';
import { SchemaStandard } from '../../../lib/schema/multiple/SchemaStandard';
import { TouchPointSchemaStringInput } from '../string/TouchPointSchemaStringInput';

/**
 * Fills in the values for a touch point email schema, as would be done when
 * editing a touch point email
 */
export const TouchPointSchema = ({
  schema,
  path,
  value,
  delegator,
  variable,
  imageHandler,
  rootValue,
  rootSchema,
}: TouchPointSchemaInputPropsTopLevel): ReactElement => {
  const subprops = {
    schema,
    path: path ?? [],
    value,
    variable,
    imageHandler,
    rootValue: rootValue ?? value,
    rootSchema: rootSchema ?? schema,
  };

  if (schema.type === 'string') {
    return <TouchPointSchemaStringInput {...subprops} />;
  }

  return (
    <SchemaStandard
      {...subprops}
      delegator={(props) => (
        <TouchPointSchema variable={variable} imageHandler={imageHandler} {...props} />
      )}
    />
  );
};
