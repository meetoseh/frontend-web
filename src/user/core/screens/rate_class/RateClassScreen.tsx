import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { initImage } from '../../lib/initImage';
import { OsehScreen } from '../../models/Screen';
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
    ...params,
    journey: convertUsingMapper(params.journey, screenJourneyMapper),
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
