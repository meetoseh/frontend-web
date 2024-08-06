import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerTransitioningPreferredAPI,
  ScreenConfigurableTriggerTransitioningTemporaryAPI,
} from '../../models/ScreenConfigurableTrigger';

export type ChoicesAPIParams = {
  /** The message at the top of the screen, typically providing context */
  top: string;

  /** The slug which identifies the question; makes it easier to find results later */
  slug: string;

  /** The header message */
  header: string;

  /** The subheader message. Supports **bold** text */
  message: string | null;

  /** The choices they can select from */
  choices: string[];

  /** True if they can select more than one, false if exactly one */
  multiple: boolean;

  /** True to require at least one option is selected, false not to */
  enforce: boolean;

  /** The call-to-action text on the button. */
  cta: string;

  /** entrance transition */
  entrance: StandardScreenTransition;

  /** exit transition for cta */
  exit: StandardScreenTransition;

  /** The client flow slug to trigger when they hit the button with no parameters */
  trigger: ScreenConfigurableTriggerTransitioningPreferredAPI;
  triggerv75: ScreenConfigurableTriggerTransitioningTemporaryAPI;

  /** True to include client parameter 'checked' with an array of strings indicating the checked options */
  include_choice: boolean;
};

export type ChoicesMappedParams = Omit<
  ChoicesAPIParams,
  'trigger' | 'triggerv75' | 'include_choice'
> & {
  /** The client flow slug to trigger when they hit the button with no parameters */
  trigger: ScreenConfigurableTrigger;
  /** True to include client parameter 'checked' with the text of the choice */
  includeChoice: boolean;
  __mapped: true;
};
