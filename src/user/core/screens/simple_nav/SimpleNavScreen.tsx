import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehScreen } from '../../models/Screen';
import { SimpleNav } from './SimpleNav';
import { SimpleNavAPIParams, SimpleNavMappedParams } from './SimpleNavParams';
import { SimpleNavResources } from './SimpleNavResources';

/**
 * An extremely basic navigation screen with a primary and secondary section
 * and a close button
 */
export const SimpleNavScreen: OsehScreen<
  'simple_nav',
  SimpleNavResources,
  SimpleNavAPIParams,
  SimpleNavMappedParams
> = {
  slug: 'simple_nav',
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
  component: (props) => <SimpleNav {...props} />,
};
