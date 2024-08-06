import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerTransitioningPreferredAPI,
  ScreenConfigurableTriggerTransitioningTemporaryAPI,
} from '../../models/ScreenConfigurableTrigger';
import { ScreenImageAPI, ScreenImageParsed } from '../../models/ScreenImage';

export type ImageInterstitialAPIParams = {
  /** The message at the top of the screen, typically providing context */
  top: string;

  /** The image to show at content width and natural height (assuming 342w x 215h natural size)  */
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
  trigger: ScreenConfigurableTriggerTransitioningPreferredAPI;
  triggerv75: ScreenConfigurableTriggerTransitioningTemporaryAPI;
};

export type ImageInterstitialMappedParams = Omit<
  ImageInterstitialAPIParams,
  'image' | 'trigger' | 'triggerv75'
> & {
  /** The image to show at content width and natural height */
  image: ScreenImageParsed;

  /** The client flow slug to trigger when they hit the button with no parameters */
  trigger: ScreenConfigurableTrigger;

  __mapped: true;
};
