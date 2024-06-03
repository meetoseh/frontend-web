import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';

export type SetNameAPIParams = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** The message at the top of the screen, typically providing context */
  top: string;

  /** The title for the question */
  title: string;

  /** Additional text below the title */
  message: string | null;

  /** If not null, handles the back button at the bottom. If null, no back button is shown */
  back: {
    /** The client flow to trigger with no parameters */
    trigger: string | null;

    /** The text for the button */
    text: string;

    /** The exit transition to use */
    exit: StandardScreenTransition;
  } | null;

  /** Handles the button for saving */
  save: {
    /** The client flow to trigger with no parameters */
    trigger: string | null;

    /** The text for the button */
    text: string;

    /** The exit transition to use */
    exit: StandardScreenTransition;
  };
};

export type SetNameMappedParams = SetNameAPIParams & {
  __mapped: true;
};
