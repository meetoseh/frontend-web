import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehScreen } from '../../models/Screen';
import { convertScreenConfigurableTriggerWithOldVersion } from '../../models/ScreenConfigurableTrigger';
import { AddPhone } from './AddPhone';
import { AddPhoneAPIParams, AddPhoneMappedParams } from './AddPhoneParams';
import { AddPhoneResources } from './AddPhoneResources';

/**
 * Allows the user to enter a phone number and click a button to send them
 * a code and go to a flow where they can enter the code.
 */
export const AddPhoneScreen: OsehScreen<
  'add_phone',
  AddPhoneResources,
  AddPhoneAPIParams,
  AddPhoneMappedParams
> = {
  slug: 'add_phone',
  paramMapper: (params) => ({
    entrance: params.entrance,
    header: params.header,
    message: params.message,
    reminders: params.reminders,
    legal: params.legal,
    cta: {
      text: params.cta.text,
      trigger: convertScreenConfigurableTriggerWithOldVersion(
        params.cta.trigger,
        params.cta.triggerv75
      ),
      exit: params.cta.exit,
    },
    back: {
      exit: params.back.exit,
      trigger: convertScreenConfigurableTriggerWithOldVersion(
        params.back.trigger,
        params.back.triggerv75
      ),
    },
    nav:
      params.nav.type !== 'nav'
        ? params.nav
        : {
            type: params.nav.type,
            title: params.nav.title,
            home: {
              trigger: convertScreenConfigurableTriggerWithOldVersion(
                params.nav.home.trigger,
                params.nav.home.triggerv75
              ),
            },
            series: {
              trigger: convertScreenConfigurableTriggerWithOldVersion(
                params.nav.series.trigger,
                params.nav.series.triggerv75
              ),
            },
          },
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    return {
      ready: createWritableValueWithCallbacks(true),
      dispose: () => {},
    };
  },
  component: (props) => <AddPhone {...props} />,
};
