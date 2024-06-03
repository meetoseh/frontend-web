import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehScreen } from '../../models/Screen';
import { SetName } from './SetName';
import { SetNameAPIParams, SetNameMappedParams } from './SetNameParams';
import { SetNameResources } from './SetNameResources';

/**
 * An extremely basic screen where the user can configure their name
 */
export const SetNameScreen: OsehScreen<
  'set_name',
  SetNameResources,
  SetNameAPIParams,
  SetNameMappedParams
> = {
  slug: 'set_name',
  paramMapper: (params) => ({
    ...params,
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    return {
      ready: createWritableValueWithCallbacks(true),
      dispose: () => {},
    };
  },
  component: (props) => <SetName {...props} />,
};
