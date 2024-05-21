import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';

type ForkAPIParamsOption = {
  /** The text to display for the option */
  text: string;
  /**
   * An identifier for this option which can make it easier to parse
   * who answered what later
   */
  slug: string;

  /** exit transition if this option is selected */
  exit: StandardScreenTransition;

  /** The trigger if the option is selected */
  trigger: string | null;
};

export type ForkAPIParams = {
  /** The header message */
  header: string;

  /** The subheader message */
  message: string;

  /** entrance transition */
  entrance: StandardScreenTransition;

  /** the options in the fork */
  options: ForkAPIParamsOption[];
};

export type ForkMappedParams = ForkAPIParams & {
  __mapped?: true;
};
