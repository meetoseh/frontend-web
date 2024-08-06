import { StandardScreenTransition } from '../../../shared/hooks/useStandardTransitions';
import {
  convertScreenConfigurableTriggerWithOldVersion,
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerTransitioningPreferredAPI,
  ScreenConfigurableTriggerTransitioningTemporaryAPI,
} from '../models/ScreenConfigurableTrigger';

export type ScreenTriggerWithExitAPI = {
  /** the trigger to use in this situation */
  trigger: ScreenConfigurableTriggerTransitioningPreferredAPI;
  triggerv75: ScreenConfigurableTriggerTransitioningTemporaryAPI;

  /** the transition to use */
  exit: StandardScreenTransition;
};

export type ScreenTriggerWithExitMapped = {
  /** the trigger to use in this situation */
  trigger: ScreenConfigurableTrigger;
  /** the transition to use */
  exit: StandardScreenTransition;
};

/**
 * Converts the API version of a button configured with a trigger and exit to
 * the mapped representation. This just refers to the combination of a trigger
 * and the exit transition.
 */
export const convertTriggerWithExit = (
  old: ScreenTriggerWithExitAPI
): ScreenTriggerWithExitMapped => ({
  trigger: convertScreenConfigurableTriggerWithOldVersion(old.trigger, old.triggerv75),
  exit: old.exit,
});
