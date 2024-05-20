import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import { ScreenContentAPI, ScreenContentParsed } from '../../models/ScreenContent';

export type VideoInterstitialAPIParams = {
  /** The title message at the bottom, typically for context */
  title: string;

  /** The full screen video to show */
  video: ScreenContentAPI;

  /** The call-to-action text on the button or null for no button. */
  cta: string | null;

  /** entrance transition */
  entrance: StandardScreenTransition;

  /** exit transition for cta */
  exit: StandardScreenTransition;

  /** The client flow slug to trigger when they hit the button or the video ends */
  trigger: string | null;
};

export type VideoInterstitialMappedParams = Omit<VideoInterstitialAPIParams, 'video'> & {
  /** The full screen video to show */
  video: ScreenContentParsed;

  __mapped?: true;
};
