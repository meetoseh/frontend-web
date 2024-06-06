import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';

export type CompletionAPIParams = {
  /** The entrance transition to use */
  entrance: StandardScreenTransition;

  /** The large title text */
  title: string;

  /** The small text above the title */
  subtitle: string | null;

  cta: {
    /** The text on the call-to-action */
    text: string;

    /** The trigger to use on the call to action */
    trigger: string | null;

    /** The exit transition when the call to action is pressed */
    exit: StandardScreenTransition;
  }
};

export type CompletionMappedParams = CompletionAPIParams & {
  __mapped: true;
};
