import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { initImage } from '../../lib/initImage';
import { OsehScreen } from '../../models/Screen';
import { screenConfigurableTriggerMapper } from '../../models/ScreenConfigurableTrigger';
import { HoldToContinue } from './HoldToContinue';
import { HoldToContinueParamsAPI, HoldToContinueParamsParsed } from './HoldToContinueParams';
import { HoldToContinueResources } from './HoldToContinueResources';

/**
 * A more interesting variation of a continue screen where the user must hold
 * a button for a certain amount of time before they can proceed. Includes
 * haptics and an animation while they are holding.
 */
export const HoldToContinueScreen: OsehScreen<
  'hold_to_continue',
  HoldToContinueResources,
  HoldToContinueParamsAPI,
  HoldToContinueParamsParsed
> = {
  slug: 'hold_to_continue',
  paramMapper: (params) => ({
    entrance: params.entrance,
    image: params.image,
    instructions: params.instructions,
    holdTimeMS: params.hold_time_ms,
    holdVibration: params.hold_vibration,
    continueVibration: params.continue_vibration,
    title: params.title,
    body: params.body,
    trigger: convertUsingMapper(params.trigger, screenConfigurableTriggerMapper),
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const { image: imageVWC, dispose: cleanupImage } = initImage({
      ctx,
      screen,
      refreshScreen,
      paramMapper: (params) => params.image,
      sizeMapper: () => ({ width: 200, height: 200 }),
    });
    return {
      ready: createWritableValueWithCallbacks(true),
      image: imageVWC,
      dispose: () => {
        cleanupImage();
      },
    };
  },
  component: (props) => <HoldToContinue {...props} />,
};
