import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehScreen } from '../../models/Screen';
import { convertScreenConfigurableTriggerWithOldVersion } from '../../models/ScreenConfigurableTrigger';
import { EmotionComponent } from './EmotionComponent';
import { EmotionAPIParams, EmotionMappedParams } from './EmotionParams';
import { EmotionResources } from './EmotionResources';

/**
 * A basic screen that presents an emotion and allows taking a regular or premium
 * class
 */
export const EmotionScreen: OsehScreen<
  'emotion',
  EmotionResources,
  EmotionAPIParams,
  EmotionMappedParams
> = {
  slug: 'emotion',
  paramMapper: (params) => ({
    ...params,
    back:
      params.back === null
        ? null
        : {
            ...params.back,
            trigger: convertScreenConfigurableTriggerWithOldVersion(
              params.back.trigger,
              params.back.triggerv75
            ),
          },
    short:
      params.short === null
        ? null
        : {
            ...params.short,
            trigger: convertScreenConfigurableTriggerWithOldVersion(
              params.short.trigger,
              params.short.triggerv75
            ),
          },
    long:
      params.long === null
        ? null
        : {
            ...params.long,
            trigger: convertScreenConfigurableTriggerWithOldVersion(
              params.long.trigger,
              params.long.triggerv75
            ),
          },
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    return {
      ready: createWritableValueWithCallbacks(true),
      dispose: () => {},
    };
  },
  component: (props) => <EmotionComponent {...props} />,
};
