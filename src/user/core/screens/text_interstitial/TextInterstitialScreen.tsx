import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehScreen } from '../../models/Screen';
import { screenConfigurableTriggerMapper } from '../../models/ScreenConfigurableTrigger';
import { screenTextContentMapper } from '../../models/ScreenTextContentMapped';
import { TextInterstitial } from './TextInterstitial';
import { TextInterstitialParamsAPI, TextInterstitialParamsMapped } from './TextInterstitialParams';
import { TextInterstitialResources } from './TextInterstitialResources';

/**
 * An text interstitial screen, with optional text at the top, dynamic text in
 * the center, then one or more calls to action at the bottom
 */
export const TextInterstitialScreen: OsehScreen<
  'text_interstitial',
  TextInterstitialResources,
  TextInterstitialParamsAPI,
  TextInterstitialParamsMapped
> = {
  slug: 'text_interstitial',
  paramMapper: (params) => ({
    entrance: params.entrance,
    top: params.top ?? null,
    content: convertUsingMapper(params.content, screenTextContentMapper),
    primaryButton:
      params.primary_button === null || params.primary_button === undefined
        ? null
        : {
            text: params.primary_button.text,
            exit: params.primary_button.exit,
            trigger: convertUsingMapper(
              params.primary_button.trigger,
              screenConfigurableTriggerMapper
            ),
          },
    secondaryButton:
      params.secondary_button === null || params.secondary_button === undefined
        ? null
        : {
            text: params.secondary_button.text,
            exit: params.secondary_button.exit,
            trigger: convertUsingMapper(
              params.secondary_button.trigger,
              screenConfigurableTriggerMapper
            ),
          },
    tertiaryButton:
      params.tertiary_button === null || params.tertiary_button === undefined
        ? null
        : {
            text: params.tertiary_button.text,
            exit: params.tertiary_button.exit,
            trigger: convertUsingMapper(
              params.tertiary_button.trigger,
              screenConfigurableTriggerMapper
            ),
          },
    __mapped: true,
  }),
  initInstanceResources: () => {
    return {
      ready: createWritableValueWithCallbacks(true),
      dispose: () => {},
    };
  },
  component: (props) => <TextInterstitial {...props} />,
};
