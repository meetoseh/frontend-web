import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehScreen } from '../../models/Screen';
import { Completion } from './Completion';
import { CompletionAPIParams, CompletionMappedParams } from './CompletionParams';
import { CompletionResources } from './CompletionResources';

/**
 * An extremely basic screen with a title and button, but shows confetti
 */
export const CompletionScreen: OsehScreen<
  'completion',
  CompletionResources,
  CompletionAPIParams,
  CompletionMappedParams
> = {
  slug: 'completion',
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
  component: (props) => <Completion {...props} />,
};
