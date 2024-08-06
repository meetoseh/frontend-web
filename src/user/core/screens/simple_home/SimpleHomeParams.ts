import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenTriggerWithExitAPI,
  ScreenTriggerWithExitMapped,
} from '../../lib/convertTriggerWithExit';

type SimpleHomeParams<T, T2> = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** Handles if the user clicks on the settings tab at the top left */
  settings: T;

  /** Handles if the user taps on their goal in the goal pill */
  goal: T;

  /** Handles if the user taps on the favorites shortcut in the top right */
  favorites: T;

  /** Configures the call to action at the bottom */
  cta: {
    /** The text on the cta */
    text: string;
  } & T &
    T2;

  /**
   * Null to disable a secondary call to action, otherwise, configures
   * the less prominent call to action below the primary one. Intended
   * to be used for temporary functionality (e.g., introducing a new
   * feature or asking for feedback)
   */
  cta2:
    | ({
        /** The text on the cta */
        text: string;
      } & T &
        T2)
    | null;
};

export type SimpleHomeAPIParams = SimpleHomeParams<
  ScreenTriggerWithExitAPI,
  { endpoint?: string | null }
>;
export type SimpleHomeMappedParams = SimpleHomeParams<ScreenTriggerWithExitMapped, {}> & {
  __mapped: true;
};
