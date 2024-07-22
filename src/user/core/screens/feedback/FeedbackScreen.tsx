import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehScreen } from '../../models/Screen';
import { Feedback } from './Feedback';
import { FeedbackAPIParams, FeedbackMappedParams } from './FeedbackParams';
import { FeedbackResources } from './FeedbackResources';

/**
 * Presents the user the opportunity to provide feedback
 */
export const FeedbackScreen: OsehScreen<
  'feedback',
  FeedbackResources,
  FeedbackAPIParams,
  FeedbackMappedParams
> = {
  slug: 'feedback',
  paramMapper: (params) => ({
    ...params,
    anonymousLabel: params.anonymous_label,
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    return {
      ready: createWritableValueWithCallbacks(true),
      dispose: () => {},
    };
  },
  component: (props) => <Feedback {...props} />,
};
