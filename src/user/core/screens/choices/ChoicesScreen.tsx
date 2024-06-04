import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehScreen } from '../../models/Screen';
import { Choices } from './Choices';
import { ChoicesAPIParams, ChoicesMappedParams } from './ChoicesParams';
import { ChoicesResources } from './ChoicesResources';

/**
 * Allows the user to choose amongst a list of options
 */
export const ChoicesScreen: OsehScreen<
  'choices',
  ChoicesResources,
  ChoicesAPIParams,
  ChoicesMappedParams
> = {
  slug: 'choices',
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
  component: (props) => <Choices {...props} />,
};
