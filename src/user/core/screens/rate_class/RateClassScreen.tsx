import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { initImage } from '../../lib/initImage';
import { OsehScreen } from '../../models/Screen';
import { convertScreenConfigurableTriggerWithOldVersion } from '../../models/ScreenConfigurableTrigger';
import { screenJourneyMapper } from '../../models/ScreenJourney';
import { RateClass } from './RateClass';
import { RateClassAPIParams, RateClassMappedParams } from './RateClassParams';
import { RateClassResources } from './RateClassResources';

/**
 * A simplified journey feedback screen where all they can do is
 * rate the journey
 */
export const RateClassScreen: OsehScreen<
  'rate_class',
  RateClassResources,
  RateClassAPIParams,
  RateClassMappedParams
> = {
  slug: 'rate_class',
  paramMapper: (params) => ({
    journey: convertUsingMapper(params.journey, screenJourneyMapper),
    entrance: params.entrance,
    header: params.header,
    message: params.message,
    background: params.background,
    cta: {
      text: params.cta.text,
      exit: params.cta.exit,
      trigger: {
        hated: convertScreenConfigurableTriggerWithOldVersion(
          params.cta.trigger.hated,
          params.cta.trigger.hatedv75
        ),
        disliked: convertScreenConfigurableTriggerWithOldVersion(
          params.cta.trigger.disliked,
          params.cta.trigger.dislikedv75
        ),
        liked: convertScreenConfigurableTriggerWithOldVersion(
          params.cta.trigger.liked,
          params.cta.trigger.likedv75
        ),
        loved: convertScreenConfigurableTriggerWithOldVersion(
          params.cta.trigger.loved,
          params.cta.trigger.lovedv75
        ),
      },
    },
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const background = initImage({
      ctx,
      screen,
      refreshScreen,
      paramMapper: (p) => (p.background !== 'journey' ? null : p.journey.blurredBackgroundImage),
      sizeMapper: (s) => s,
    });

    return {
      ready: createWritableValueWithCallbacks(true),
      background: {
        image: background.image,
        thumbhash: background.thumbhash,
      },
      dispose: () => {
        background.dispose();
      },
    };
  },
  component: (props) => <RateClass {...props} />,
};
