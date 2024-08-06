import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerTransitioningPreferredAPI,
  ScreenConfigurableTriggerTransitioningTemporaryAPI,
} from '../../models/ScreenConfigurableTrigger';

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
    trigger: ScreenConfigurableTriggerTransitioningPreferredAPI;
    triggerv75: ScreenConfigurableTriggerTransitioningTemporaryAPI;

    /** The exit transition when the call to action is pressed */
    exit: StandardScreenTransition;
  };
};

export type CompletionMappedParams = Omit<CompletionAPIParams, 'cta'> & {
  cta: {
    text: string;
    trigger: ScreenConfigurableTrigger;
    exit: StandardScreenTransition;
  };
  __mapped: true;
};
