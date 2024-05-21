import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehScreen } from '../../models/Screen';
import { Fork } from './Fork';
import { ForkAPIParams, ForkMappedParams } from './ForkParams';
import { ForkResources } from './ForkResources';

/**
 * Allows the user to choose where to go via a header, message,
 * and series of options
 */
export const ForkScreen: OsehScreen<'fork', ForkResources, ForkAPIParams, ForkMappedParams> = {
  slug: 'fork',
  paramMapper: (params) => ({
    ...params,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    return {
      ready: createWritableValueWithCallbacks(true),
      dispose: () => {},
    };
  },
  component: (props) => <Fork {...props} />,
};
