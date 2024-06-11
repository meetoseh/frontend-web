import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import { ScreenContentAPI, ScreenContentParsed } from '../../models/ScreenContent';

export type VideoInterstitialAPIParams = {
  /** The title message at the bottom, typically for context */
  title: string;

  /** Optional short subtitle above the title, e.g., author */
  subtitle: string | null;

  /** The full screen video to show */
  video: ScreenContentAPI;

  /** The call-to-action text on the button or null for no button. */
  cta: string | null;

  /** If true, a X button is rendered in the top-right, which does the same thing as the skip button */
  close: boolean;

  /** If true, adjusts styling to be less defensive about the background color, assuming its dark instead */
  dark: boolean;

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
