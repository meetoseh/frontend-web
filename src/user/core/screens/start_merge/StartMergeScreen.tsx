import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { convertTriggerWithExit } from '../../lib/convertTriggerWithExit';
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
    entrance: params.entrance,
    header: params.header,
    message: params.message,
    providers: params.providers,
    skip: {
      ...convertTriggerWithExit(params.skip),
      text: params.skip.text,
    },
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
