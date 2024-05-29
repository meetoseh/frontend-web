import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehScreen } from '../../models/Screen';
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
