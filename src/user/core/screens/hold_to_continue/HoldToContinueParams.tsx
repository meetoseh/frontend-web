import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerAPI,
} from '../../models/ScreenConfigurableTrigger';
import { ScreenImageAPI, ScreenImageParsed } from '../../models/ScreenImage';

export type HoldToContinueParamsAPI = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** The image, rendered initially at a logical size of 80x80 and grows to 200x200 */
  image: ScreenImageAPI;

  /** the instructions text */
  instructions: string;

  /** How long the user has to hold to continue, in milliseconds */
  hold_time_ms: number;

  /**
   * The hold vibration that starts when they start holding and stops when they reach
   * the hold time or stop holding. Pairs of (on, off)
   */
  hold_vibration: number[];

  /**
   * The vibration that plays while the animation is playing. Pairs of (on, off). The
   * animation duration is amount of time this vibration pattern will play. The user
   * doesn't need to hold during this time
   */
  continue_vibration: number[];

  /** the title text */
  title: string;

  /** the body text */
  body: string;

  /** the trigger after they hold */
  trigger: ScreenConfigurableTriggerAPI;
};

export type HoldToContinueParamsParsed = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** The image, rendered initially at a logical size of 80x80 and grows to 200x200 */
  image: ScreenImageParsed;

  /** the instructions text */
  instructions: string;

  /** How long the user has to hold to continue, in milliseconds */
  holdTimeMS: number;

  /**
   * the vibration pattern which starts when they begin holding and gets
   * canceled if they lift or complete the hold. alternating amounts of
   * (on, off, on, off, ...) in milliseconds.
   */
  holdVibration: number[];

  /**
   * The vibration that plays while the animation is playing. Pairs of (on, off). The
   * animation duration is amount of time this vibration pattern will play.
   */
  continueVibration: number[];

  /** the title text */
  title: string;

  /** the body text */
  body: string;

  /** the trigger after they hold */
  trigger: ScreenConfigurableTrigger;

  __mapped: true;
};
