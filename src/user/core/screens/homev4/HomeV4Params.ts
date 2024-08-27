import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerAPI,
} from '../../models/ScreenConfigurableTrigger';

type HomeV4Params<T> = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** Handles if the user hits the menu icon in the header */
  menu: T;

  /** Handles if the user taps their goal */
  goal: T;

  /** Handles if the user hits the play button */
  classes: T;

  /** Handles if the user hits the favorites button */
  favorites: T;

  /** Handles if the user hits the checkin button */
  checkin: T & {
    /** The text on the button */
    text: string;
  };
};

export type HomeV4APIParams = HomeV4Params<{
  /** The exit transition to use */
  exit: StandardScreenTransition;

  /** The trigger */
  trigger: ScreenConfigurableTriggerAPI;
}>;

export type HomeV4MappedParams = HomeV4Params<{
  /** The exit transition to use */
  exit: StandardScreenTransition;

  /** The trigger */
  trigger: ScreenConfigurableTrigger;
}> & {
  __mapped: true;
};
