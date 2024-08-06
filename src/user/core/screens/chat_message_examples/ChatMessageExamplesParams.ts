import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerTransitioningPreferredAPI,
  ScreenConfigurableTriggerTransitioningTemporaryAPI,
} from '../../models/ScreenConfigurableTrigger';

export type ChatMessageExamplesAPIParams = {
  /** The header text */
  header: string;

  /** The body text below the header */
  body: string;

  /** The message examples to highlight */
  messages: string[];

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

export type ChatMessageExamplesMappedParams = Omit<
  ChatMessageExamplesAPIParams,
  'trigger' | 'triggerv75'
> & {
  trigger: ScreenConfigurableTrigger;
  __mapped: true;
};
