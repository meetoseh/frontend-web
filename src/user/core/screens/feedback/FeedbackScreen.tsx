import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehScreen } from '../../models/Screen';
import { convertScreenConfigurableTriggerWithOldVersion } from '../../models/ScreenConfigurableTrigger';
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
    cta2:
      params.cta2 === null
        ? null
        : {
            ...params.cta2,
            trigger: convertScreenConfigurableTriggerWithOldVersion(
              params.cta2.trigger,
              params.cta2.triggerv75
            ),
          },
    close: convertScreenConfigurableTriggerWithOldVersion(params.close, params.closev75),
    trigger: convertScreenConfigurableTriggerWithOldVersion(params.trigger, params.triggerv75),
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
