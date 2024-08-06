import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import { InteractivePrompt } from '../../../interactive_prompt/models/InteractivePrompt';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerTransitioningPreferredAPI,
  ScreenConfigurableTriggerTransitioningTemporaryAPI,
} from '../../models/ScreenConfigurableTrigger';
import { ScreenImageAPI, ScreenImageParsed } from '../../models/ScreenImage';

export type InteractivePromptAPIParams = {
  prompt: unknown;
  background: ScreenImageAPI | null;

  /** The title for the countdown, or null for no countdown */
  countdown: string | null;

  /** If specified, small text displayed above the prompt, e.g., "Class Poll" */
  subtitle: string | null;

  /** entrance transition */
  entrance: StandardScreenTransition;

  /** exit transition for cta */
  exit: StandardScreenTransition;

  /** The client flow slug to trigger when they finish */
  trigger: ScreenConfigurableTriggerTransitioningPreferredAPI;
  triggerv75: ScreenConfigurableTriggerTransitioningTemporaryAPI;
};

export type InteractivePromptMappedParams = Omit<
  InteractivePromptAPIParams,
  'prompt' | 'background' | 'trigger' | 'triggerv75'
> & {
  /** The prompt to display */
  prompt: InteractivePrompt;

  /** The full screen background image or null for the standard dark gray gradient */
  background: ScreenImageParsed | null;

  /** The client flow slug to trigger when they finish */
  trigger: ScreenConfigurableTrigger;
  __mapped: true;
};
