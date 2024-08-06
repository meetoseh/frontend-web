import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehScreen } from '../../models/Screen';
import { convertScreenConfigurableTriggerWithOldVersion } from '../../models/ScreenConfigurableTrigger';
import { Fork } from './Fork';
import { ForkAPIParams, ForkMappedParams } from './ForkParams';
import { ForkResources } from './ForkResources';

/**
 * Allows the user to choose where to go via a header, message,
 * and series of options
 */
export const ForkScreen: OsehScreen<'fork', ForkResources, ForkAPIParams, ForkMappedParams> = {
  slug: 'fork',
  paramMapper: (params) => ({
    header: params.header,
    message: params.message,
    entrance: params.entrance,
    options: params.options.map((o) => ({
      text: o.text,
      slug: o.slug,
      exit: o.exit,
      trigger: convertScreenConfigurableTriggerWithOldVersion(o.trigger, o.triggerv75),
    })),
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    return {
      ready: createWritableValueWithCallbacks(true),
      dispose: () => {},
    };
  },
  component: (props) => <Fork {...props} />,
};
