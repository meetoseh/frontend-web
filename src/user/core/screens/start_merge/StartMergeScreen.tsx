import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehScreen } from '../../models/Screen';
import { StartMerge } from './StartMerge';
import { StartMergeAPIParams, StartMergeMappedParams } from './StartMergeParams';
import { StartMergeResources } from './StartMergeResources';

/**
 * Allows a logged in user to merge their account by signing in with another
 * identity.
 */
export const StartMergeScreen: OsehScreen<
  'start_merge',
  StartMergeResources,
  StartMergeAPIParams,
  StartMergeMappedParams
> = {
  slug: 'start_merge',
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
  component: (props) => <StartMerge {...props} />,
};
