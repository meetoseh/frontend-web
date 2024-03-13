import { Emotion } from '../pickEmotionJourney/Emotion';

export type ShowEmotion = {
  /** The emotion that the user will be able to see */
  emotion: Emotion;
  /**
   * True if this is specified in an anticipatory way; this will cause
   * resources to be loaded without the component requesting to be shown
   */
  anticipatory: boolean;
};

/**
 * The information required to determine if the goto emotion screen
 * should be displayed, plus anything we want to share with other features
 */
export type GotoEmotionState = {
  /**
   * The emotion to show, undefined if still deciding, and null if this screen
   * does not want to be shown.
   */
  show: ShowEmotion | null | undefined;

  /**
   * If show is undefined, calling this raises an error. Otherwise,
   * sets the value of show and updates the window history if necessary.
   */
  setShow: (show: ShowEmotion | null, updateWindowHistory: boolean) => void;
};
