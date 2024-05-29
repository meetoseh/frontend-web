import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';

export type HomeAPIParams = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** Handles if the user clicks one of the available emotions */
  emotion: {
    /**
     * The trigger to use via pop_to_emotion, which will ultimately trigger
     * this flow with `emotion` (the word) and `journey` (the class uid) set.
     */
    trigger: string;

    /** The exit transition */
    exit: StandardScreenTransition;
  };

  /** Handles if the user clicks the series tab at the bottom */
  series: {
    /** The trigger to use with no parameters */
    trigger: string;

    /** The exit transition */
    exit: StandardScreenTransition;
  };

  /** Handles if the user clicks on the account tab at the bottom */
  account: {
    /** The trigger slug to use with no parameters */
    trigger: string;

    /** The exit transition */
    exit: StandardScreenTransition;
  };

  /** Handles if the user taps on their goal in the goal pill */
  goal: {
    /** The trigger to use with no parameters */
    trigger: string;

    /** The exit transition */
    exit: StandardScreenTransition;
  };
};

export type HomeMappedParams = HomeAPIParams & {
  __mapped?: true;
};
