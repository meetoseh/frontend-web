import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerTransitioningPreferredAPI,
  ScreenConfigurableTriggerTransitioningTemporaryAPI,
} from '../../models/ScreenConfigurableTrigger';
import { ScreenImageAPI, ScreenImageParsed } from '../../models/ScreenImage';
import {
  ScreenTextContentAPI,
  ScreenTextContentMapped,
} from '../../models/ScreenTextContentMapped';

export type LargeImageInterstitialAPIParams = {
  /** The message at the top of the screen, typically providing context */
  top: string;

  /** docs in mapped params since it's more likely to be hovered */
  image: ScreenImageAPI;

  /** The text content for the screen */
  content: ScreenTextContentAPI;

  /** docs in mapped params since it's more likely to be hovered */
  assumed_content_height: number;

  /** The call-to-action text on the button. */
  cta: string;

  /** entrance transition */
  entrance: StandardScreenTransition;

  /** exit transition for cta */
  exit: StandardScreenTransition;

  /** The client flow slug to trigger when they hit the button with no parameters */
  trigger: ScreenConfigurableTriggerTransitioningPreferredAPI;
  triggerv75: ScreenConfigurableTriggerTransitioningTemporaryAPI;
};

export type LargeImageInterstitialMappedParams = Omit<
  LargeImageInterstitialAPIParams,
  'image' | 'assumed_content_height' | 'content' | 'trigger' | 'triggerv75'
> & {
  /**
   * The image to show. We always use the content width for the width; for the
   * height, we render either at 237, 314, or 390px tall, based on if there is
   * enough space available at a 1x font scale (which may mean this screen scrolls
   * at higher font scales).
   *
   * Specifically, the available space is computed as
   * ```
   * windowHeight
   * - top bar height (native only)
   * - 32 (top to top text spacing)
   * - 24 (top text without line wrap)
   * - 32 (top text to image spacing)
   * - 32 (image to header spacing)
   * - 160 [OVERRIDABLE] (assumed header + text height)
   * - 32 (header + text to cta spacing)
   * - 56 (cta height)
   * - 32 (cta to bottom spacing)
   * - bottom bar height (native only)
   * ```
   */
  image: ScreenImageParsed;

  /** The text content for the screen */
  content: ScreenTextContentMapped;

  /**
   * The assumed height in pixels of the header + text, used in the calculation
   * for determining which image breakpoint to use. Generally, 160px is a good
   * default.
   */
  assumedContentHeight: number;

  /** The trigger when the cta is pressed */
  trigger: ScreenConfigurableTrigger;

  __mapped: true;
};
