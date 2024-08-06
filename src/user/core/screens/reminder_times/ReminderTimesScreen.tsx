import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RequestResult } from '../../../../shared/requests/RequestHandler';
import { unwrapRequestResult } from '../../../../shared/requests/unwrapRequestResult';
import { createLoginContextRequest } from '../../lib/createLoginContextRequest';
import { OsehScreen } from '../../models/Screen';
import { convertScreenConfigurableTriggerWithOldVersion } from '../../models/ScreenConfigurableTrigger';
import { ReminderTimes } from './ReminderTimes';
import { ReminderTimesAPIParams, ReminderTimesMappedParams } from './ReminderTimesParams';
import { ReminderTimesResources } from './ReminderTimesResources';
import { ReminderChannelsInfo } from './lib/createReminderChannelsHandler';
import { ReminderSettings } from './lib/createReminderSettingsHandler';

/**
 * Allows the user to configure their notification settings.
 */
export const ReminderTimesScreen: OsehScreen<
  'reminder_times',
  ReminderTimesResources,
  ReminderTimesAPIParams,
  ReminderTimesMappedParams
> = {
  slug: 'reminder_times',
  paramMapper: (params) => ({
    entrance: params.entrance,
    channels: params.channels,
    header: params.header,
    message: params.message,
    back: {
      exit: params.back.exit,
      trigger: convertScreenConfigurableTriggerWithOldVersion(
        params.back.trigger,
        params.back.triggerv75
      ),
      draft: params.back.draft,
    },
    cta: {
      next: params.cta.next ?? null,
      final: params.cta.final,
      trigger: convertScreenConfigurableTriggerWithOldVersion(
        params.cta.trigger,
        params.cta.triggerv75
      ),
      exit: params.cta.exit,
    },
    nav:
      params.nav.type === 'nav'
        ? {
            type: 'nav',
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
          }
        : params.nav,
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const getChannels = () =>
      createLoginContextRequest({ ctx, handler: ctx.resources.reminderChannelsHandler });

    const channelsRequest =
      createWritableValueWithCallbacks<RequestResult<ReminderChannelsInfo> | null>(null);
    const cleanupChannelsRequest = createValueWithCallbacksEffect(
      ctx.login.value,
      () => {
        const req = getChannels();
        setVWC(channelsRequest, req);
        return () => {
          req.release();
          if (Object.is(channelsRequest.get(), req)) {
            setVWC(channelsRequest, null);
          }
        };
      },
      {
        applyBeforeCancel: true,
      }
    );
    const [channelsUnwrapped, cleanupChannelsUnwrapper] = unwrapRequestResult(
      channelsRequest,
      (d) => d.data,
      () => null
    );

    const getSettings = () =>
      createLoginContextRequest({ ctx, handler: ctx.resources.reminderSettingsHandler });

    const settingsRequest =
      createWritableValueWithCallbacks<RequestResult<ReminderSettings> | null>(null);
    const cleanupSettingsRequest = createValueWithCallbacksEffect(
      ctx.login.value,
      () => {
        const req = getSettings();
        setVWC(settingsRequest, req);
        return () => {
          req.release();
          if (Object.is(settingsRequest.get(), req)) {
            setVWC(settingsRequest, null);
          }
        };
      },
      {
        applyBeforeCancel: true,
      }
    );
    const [settingsUnwrapped, cleanupSettingsUnwrapper] = unwrapRequestResult(
      settingsRequest,
      (d) => d.data,
      () => null
    );

    return {
      ready: createWritableValueWithCallbacks(true),
      channelsInfo: channelsUnwrapped,
      settings: settingsUnwrapped,
      dispose: () => {
        cleanupChannelsRequest();
        cleanupChannelsUnwrapper();
        cleanupSettingsRequest();
        cleanupSettingsUnwrapper();
      },
    };
  },
  component: (props) => <ReminderTimes {...props} />,
};
