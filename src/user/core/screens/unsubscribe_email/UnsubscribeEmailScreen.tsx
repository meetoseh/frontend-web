import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehScreen } from '../../models/Screen';
import { screenConfigurableTriggerMapper } from '../../models/ScreenConfigurableTrigger';
import { UnsubscribeEmail } from './UnsubscribeEmail';
import { UnsubscribeEmailParamsAPI, UnsubscribeEmailParamsMapped } from './UnsubscribeEmailParams';
import { UnsubscribeEmailResources } from './UnsubscribeEmailResources';

/**
 * Allows the user to unsubscribe an arbitrary email address from notifications, in case they
 * are having trouble logging into that account
 */
export const UnsubscribeEmailScreen: OsehScreen<
  'unsubscribe_email',
  UnsubscribeEmailResources,
  UnsubscribeEmailParamsAPI,
  UnsubscribeEmailParamsMapped
> = {
  slug: 'unsubscribe_email',
  paramMapper: (params) => ({
    entrance: params.entrance,
    header: params.header,
    close: {
      variant: params.close.variant,
      trigger: convertUsingMapper(params.close.trigger, screenConfigurableTriggerMapper),
      exit: params.close.exit,
    },
    title: params.title ?? null,
    body: params.body ?? null,
    code: params.code ?? null,
    placeholder: params.placeholder,
    help: params.help ?? null,
    cta: {
      text: params.cta.text,
      trigger: convertUsingMapper(params.cta.trigger, screenConfigurableTriggerMapper),
      exit: params.cta.exit,
    },
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    return {
      ready: createWritableValueWithCallbacks(true),
      dispose: () => {},
    };
  },
  component: (props) => <UnsubscribeEmail {...props} />,
};
