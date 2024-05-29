import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';

export type EmotionAPIParams = {
  /** The header message, above the emotion */
  header: string;

  /** The emotion that we are highlighting */
  emotion: string;

  /** The subheader text, below the emotion */
  subheader: string | null;

  /** entrance transition */
  entrance: StandardScreenTransition;

  /** Handles if the user taps on the back button, or null for no back button */
  back: {
    /** The trigger to use with no parameters */
    trigger: string | null;

    /** The exit transition */
    exit: StandardScreenTransition;
  } | null;

  /** Handles the first, non-premium CTA. */
  short: {
    /** The trigger to use. Passed emotion and journey in the server parameters */
    trigger: string | null;

    /** The text for the button */
    text: string;

    /** The exit transition */
    exit: StandardScreenTransition;
  } | null;

  /** Handles the second, premium CTA */
  long: {
    /** The trigger to use. Passed emotion and journey in the server parameters */
    trigger: string | null;

    /** The text for the button */
    text: string;

    /** The exit transition */
    exit: StandardScreenTransition;
  } | null;
};

export type EmotionMappedParams = EmotionAPIParams & {
  __mapped: true;
};
