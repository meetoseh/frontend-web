import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerTransitioningPreferredAPI,
  ScreenConfigurableTriggerTransitioningTemporaryAPI,
} from '../../models/ScreenConfigurableTrigger';

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
  trigger: ScreenConfigurableTriggerTransitioningPreferredAPI;
  triggerv75: ScreenConfigurableTriggerTransitioningTemporaryAPI;
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

type ForkMappedParamsOption = Omit<ForkAPIParamsOption, 'trigger' | 'triggerv75'> & {
  /** The trigger if the option is selected */
  trigger: ScreenConfigurableTrigger;
};

export type ForkMappedParams = Omit<ForkAPIParams, 'options'> & {
  /** the options in the fork */
  options: ForkMappedParamsOption[];
  __mapped: true;
};
