import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { yAxisPhysicalPerLogical } from '../../../../shared/images/DisplayRatioHelper';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { initImage } from '../../lib/initImage';
import { OsehScreen } from '../../models/Screen';
import { convertScreenConfigurableTriggerWithOldVersion } from '../../models/ScreenConfigurableTrigger';
import { screenImageKeyMap } from '../../models/ScreenImage';
import { screenTextContentMapper } from '../../models/ScreenTextContentMapped';
import { LargeImageInterstitial } from './LargeImageInterstitial';
import {
  LargeImageInterstitialAPIParams,
  LargeImageInterstitialMappedParams,
} from './LargeImageInterstitialParams';
import { LargeImageInterstitialResources } from './LargeImageInterstitialResources';

/**
 * A somewhat sophisticated image interstitial; top message, image, variable
 * content, button with CTA. The image height has a few thresholds based on the
 * screen height so it can generally be taller.
 */
export const LargeImageInterstitialScreen: OsehScreen<
  'large_image_interstitial',
  LargeImageInterstitialResources,
  LargeImageInterstitialAPIParams,
  LargeImageInterstitialMappedParams
> = {
  slug: 'large_image_interstitial',
  paramMapper: (params) => ({
    top: params.top,
    image: convertUsingMapper(params.image, screenImageKeyMap),
    content: convertUsingMapper(params.content, screenTextContentMapper),
    assumedContentHeight: params.assumed_content_height,
    cta: params.cta,
    entrance: params.entrance,
    exit: params.exit,
    trigger: convertScreenConfigurableTriggerWithOldVersion(params.trigger, params.triggerv75),
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const activeVWC = createWritableValueWithCallbacks(true);

    const image = initImage({
      ctx,
      screen,
      refreshScreen,
      paramMapper: (params) => params.image,
      sizeMapper: () => {
        const cw = ctx.contentWidth.get();
        const naturalWidth = 342;

        // see docs for image
        const availableHeight =
          ctx.windowSizeImmediate.get().height -
          32 -
          24 -
          32 -
          32 -
          screen.parameters.assumedContentHeight -
          32 -
          56 -
          32;

        let naturalHeight = 237;
        if (availableHeight >= 390) {
          naturalHeight = 390;
        } else if (availableHeight >= 314) {
          naturalHeight = 314;
        }

        return {
          width: cw,
          height:
            Math.floor(cw * (naturalHeight / naturalWidth) * yAxisPhysicalPerLogical) /
            yAxisPhysicalPerLogical,
        };
      },
    });

    return {
      ready: createWritableValueWithCallbacks(true),
      imageSizeImmediate: image.sizeImmediate,
      image: image.image,
      dispose: () => {
        setVWC(activeVWC, false);
        image.dispose();
      },
    };
  },
  component: (props) => <LargeImageInterstitial {...props} />,
};
