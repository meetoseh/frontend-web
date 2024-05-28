import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import { ScreenContentAPI, ScreenContentParsed } from '../../models/ScreenContent';
import { ScreenImageAPI, ScreenImageParsed } from '../../models/ScreenImage';

export type AudioInterstitialAPIParams = {
  /** The title message at the bottom, typically for context */
  title: string;

  audio: ScreenContentAPI;
  background: ScreenImageAPI | null;

  /** The call-to-action text on the button or null for no button. */
  cta: string | null;

  /** entrance transition */
  entrance: StandardScreenTransition;

  /** exit transition for cta */
  exit: StandardScreenTransition;

  /** The client flow slug to trigger when they hit the button or the video ends */
  trigger: string | null;
};

export type AudioInterstitialMappedParams = Omit<
  AudioInterstitialAPIParams,
  'audio' | 'background'
> & {
  /** The audio to play */
  audio: ScreenContentParsed;

  /** The background image or null for the dark gray gradient */
  background: ScreenImageParsed | null;

  __mapped?: true;
};
