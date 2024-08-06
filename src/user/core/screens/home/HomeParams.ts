import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenTriggerWithExitAPI,
  ScreenTriggerWithExitMapped,
} from '../../lib/convertTriggerWithExit';

type HomeParams<T> = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** Handles if the user clicks one of the available emotions. Adds `emotion` in the client parameters */
  emotion: T;

  /** Handles if the user clicks the series tab at the bottom */
  series: T;

  /** Handles if the user clicks on the account tab at the bottom */
  account: T;

  /** Handles if the user taps on their goal in the goal pill */
  goal: T;
};

export type HomeAPIParams = HomeParams<ScreenTriggerWithExitAPI>;
export type HomeMappedParams = HomeParams<ScreenTriggerWithExitMapped> & {
  __mapped: true;
};
