import { Emotion } from '../../../../shared/models/Emotion';

export type ShowEmotion = {
  /** The emotion that the user will be able to see */
  emotion: Emotion;
  /**
   * True if this is specified in an anticipatory way; this will cause
   * resources to be loaded without the component requesting to be shown
   */
  anticipatory: boolean;

  /**
   * Hints for how to animate the transition to this screen
   */
  animationHints?: {
    /**
     * If the previous screen has frozen an emotion button whose content
     * matches the emotion word in titlecase, this is the client rect
     * of that button. It will be transitioned into place
     */
    emotionStart: { top: number; left: number; right: number; bottom: number };
  };
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
