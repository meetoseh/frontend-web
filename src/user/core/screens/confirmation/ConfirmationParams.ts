import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerTransitioningPreferredAPI,
  ScreenConfigurableTriggerTransitioningTemporaryAPI,
} from '../../models/ScreenConfigurableTrigger';

export type ConfirmationAPIParams = {
  /** The header message */
  header: string;

  /** The subheader message */
  message: string;

  /** The call-to-action text on the button. */
  cta: string;

  /** entrance transition */
  entrance: StandardScreenTransition;

  /** exit transition for cta */
  exit: StandardScreenTransition;

  /** The client flow slug to trigger when they hit the button with no parameters */
  trigger: ScreenConfigurableTriggerTransitioningPreferredAPI;
  triggerv75: ScreenConfigurableTriggerTransitioningTemporaryAPI;
};

export type ConfirmationMappedParams = Omit<ConfirmationAPIParams, 'trigger' | 'triggerv75'> & {
  trigger: ScreenConfigurableTrigger;
  __mapped: true;
};
