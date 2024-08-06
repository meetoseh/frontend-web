import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenTriggerWithExitAPI,
  ScreenTriggerWithExitMapped,
} from '../../lib/convertTriggerWithExit';

export type SetGoalAPIParams = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** The message at the top of the screen, typically providing context */
  top: string;

  /** The title for the question */
  title: string;

  /** Additional text below the title */
  message: string;

  /** If not null, handles the back button at the bottom. If null, no back button is shown */
  back:
    | (ScreenTriggerWithExitAPI & {
        /** The text for the button */
        text: string;
      })
    | null;

  /** Handles the button for saving */
  save: ScreenTriggerWithExitAPI & {
    /** The text for the button */
    text: string;
  };
};

export type SetGoalMappedParams = Omit<SetGoalAPIParams, 'back' | 'save'> & {
  /** If not null, handles the back button at the bottom. If null, no back button is shown */
  back: (ScreenTriggerWithExitMapped & { text: string }) | null;
  /** Handles the button for saving */
  save: ScreenTriggerWithExitMapped & { text: string };
  __mapped: true;
};
