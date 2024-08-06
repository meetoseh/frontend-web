import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehScreen } from '../../models/Screen';
import { convertScreenConfigurableTriggerWithOldVersion } from '../../models/ScreenConfigurableTrigger';
import { SimpleNav } from './SimpleNav';
import { SimpleNavAPIParams, SimpleNavMappedParams } from './SimpleNavParams';
import { SimpleNavResources } from './SimpleNavResources';

const mapItem = (i: SimpleNavAPIParams['primary'][0]): SimpleNavMappedParams['primary'][0] =>
  i.type === 'link'
    ? i
    : {
        type: i.type,
        text: i.text,
        trigger: convertScreenConfigurableTriggerWithOldVersion(i.trigger, i.triggerv75),
      };
/**
 * An extremely basic navigation screen with a primary and secondary section
 * and a close button
 */
export const SimpleNavScreen: OsehScreen<
  'simple_nav',
  SimpleNavResources,
  SimpleNavAPIParams,
  SimpleNavMappedParams
> = {
  slug: 'simple_nav',
  paramMapper: (params) => ({
    entrance: params.entrance,
    exit: params.exit,
    close: convertScreenConfigurableTriggerWithOldVersion(params.close, params.closev75),
    primary: params.primary.map(mapItem),
    secondary: params.secondary.map(mapItem),
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    return {
      ready: createWritableValueWithCallbacks(true),
      dispose: () => {},
    };
  },
  component: (props) => <SimpleNav {...props} />,
};
