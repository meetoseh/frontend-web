import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';

export type ChooseAFeelingAPIParams = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** The message at the top of the screen, typically providing context */
  top: string;

  /** The header message */
  header: string;

  /** The subheader message */
  message: string | null;

  /** True if we trigger via `pop_to_emotion`, false for a regular trigger */
  direct: boolean;

  /** Ignored unless direct is true. If direct, true for a premium class, false for a regular class */
  premium: boolean;

  /**
   * The trigger to use.
   *
   * If direct is true, uses `pop_to_emotion`, which will ultimately trigger
   * this flow with `emotion` (the word) and `journey` (the class uid) set
   * in the server parameters.
   *
   * If direct is false, a regular trigger with the emotion in the client
   * parameters.
   */
  trigger: string | null;

  /** The exit transition */
  exit: StandardScreenTransition;
};

export type ChooseAFeelingMappedParams = ChooseAFeelingAPIParams & {
  __mapped: true;
};
