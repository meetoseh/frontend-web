import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import { ScreenImageAPI, ScreenImageParsed } from '../../models/ScreenImage';

export type ImageInterstitialAPIParams = {
  /** The message at the top of the screen, typically providing context */
  top: string;

  /** The image to show at content width and natural height */
  image: ScreenImageAPI;

  /** The header message */
  header: string;

  /** The subheader message */
  message: string;

  /** The call-to-action text on the button. */
  cta: string;

  /** entrance transition */
  entrance: StandardScreenTransition;

  /** exit transition for cta */
  exit: StandardScreenTransition;

  /** The client flow slug to trigger when they hit the button with no parameters */
  trigger: string | null;
};

export type ImageInterstitialMappedParams = Omit<ImageInterstitialAPIParams, 'image'> & {
  /** The image to show at content width and natural height */
  image: ScreenImageParsed;

  __mapped?: true;
};
