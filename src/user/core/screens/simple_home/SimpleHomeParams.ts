import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';

export type SimpleHomeAPIParams = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** Handles if the user clicks on the settings tab at the top left */
  settings: {
    /** The trigger to use with no parameters */
    trigger: string | null;

    /** The exit transition */
    exit: StandardScreenTransition;
  };

  /** Handles if the user taps on their goal in the goal pill */
  goal: {
    /** The trigger to use with no parameters */
    trigger: string | null;

    /** The exit transition */
    exit: StandardScreenTransition;
  };

  /** Handles if the user taps on the favorites shortcut in the top right */
  favorites: {
    /** The trigger to use with no parameters */
    trigger: string | null;

    /** The exit transition */
    exit: StandardScreenTransition;
  };

  /** Configures the call to action at the bottom */
  cta: {
    /** The text on the cta */
    text: string;

    /** The trigger to use with no parameters */
    trigger: string | null;

    /** The exit transition */
    exit: StandardScreenTransition;
  };

  /**
   * Null to disable a secondary call to action, otherwise, configures
   * the less prominent call to action below the primary one. Intended
   * to be used for temporary functionality (e.g., introducing a new
   * feature or asking for feedback)
   */
  cta2: {
    /** The text on the cta */
    text: string;

    /** The trigger to use with no parameters */
    trigger: string | null;

    /** The exit transition */
    exit: StandardScreenTransition;
  } | null;
};

export type SimpleHomeMappedParams = SimpleHomeAPIParams & {
  __mapped?: true;
};
