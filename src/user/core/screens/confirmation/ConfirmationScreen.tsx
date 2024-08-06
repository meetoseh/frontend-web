import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehScreen } from '../../models/Screen';
import { convertScreenConfigurableTriggerWithOldVersion } from '../../models/ScreenConfigurableTrigger';
import { Confirmation } from './Confirmation';
import { ConfirmationAPIParams, ConfirmationMappedParams } from './ConfirmationParams';
import { ConfirmationResources } from './ConfirmationResources';

/**
 * An extremely basic screen with a header, message, and ok button.
 */
export const ConfirmationScreen: OsehScreen<
  'confirmation',
  ConfirmationResources,
  ConfirmationAPIParams,
  ConfirmationMappedParams
> = {
  slug: 'confirmation',
  paramMapper: (params) => ({
    ...params,
    trigger: convertScreenConfigurableTriggerWithOldVersion(params.trigger, params.triggerv75),
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    return {
      ready: createWritableValueWithCallbacks(true),
      dispose: () => {},
    };
  },
  component: (props) => <Confirmation {...props} />,
};
