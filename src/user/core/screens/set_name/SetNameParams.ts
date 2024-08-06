import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenTriggerWithExitAPI,
  ScreenTriggerWithExitMapped,
} from '../../lib/convertTriggerWithExit';

type SetNameParams<T> = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** The message at the top of the screen, typically providing context */
  top: string;

  /** The title for the question */
  title: string;

  /** Additional text below the title */
  message: string | null;

  /** If not null, handles the back button at the bottom. If null, no back button is shown */
  back:
    | ({
        /** The text for the button */
        text: string;
      } & T)
    | null;

  /** Handles the button for saving */
  save: {
    /** The text for the button */
    text: string;
  } & T;
};

export type SetNameAPIParams = SetNameParams<ScreenTriggerWithExitAPI>;
export type SetNameMappedParams = SetNameParams<ScreenTriggerWithExitMapped> & {
  __mapped: true;
};
