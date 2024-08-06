import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerTransitioningPreferredAPI,
  ScreenConfigurableTriggerTransitioningTemporaryAPI,
} from '../../models/ScreenConfigurableTrigger';
import { Channel } from './lib/Channel';

type ReminderTimesParams<T> = {
  /** The entrance transition */
  entrance: StandardScreenTransition;

  /**
   * The channels that we will show in the top. We will omit channels that
   * the user cannot receive notifications for according to
   * `/api/1/users/me/wants_notification_time_prompt`. If the intersection
   * of this and the channels they can configure is empty the screen is
   * immediately skipped.
   *
   * We will match the order in this list; so if this list is ['email', 'sms'],
   * then email will always be shown before SMS when they are both present.
   */
  channels: Channel[];

  /** The header message to use. We replace [channel] with the channel that is selected */
  header: string;

  /** The text below the header. We replace [channel] with the channel that is selected */
  message: string;

  /** Configures the back button in the upper left */
  back: {
    /** The exit transition to use */
    exit: StandardScreenTransition;

    /** Handles what to do if they have unsaved changes when they hit the back button */
    draft:
      | {
          /** Always save the changes without asking */
          type: 'save';
        }
      | {
          /** Always discard the changes without asking */
          type: 'discard';
        }
      | {
          /** Provide a popup to determine if we should save */
          type: 'confirm';
          /** The title of the popup. Can use [channel] for the channel. */
          title: string;
          /** The message within the popup. Can use [channel] for the channel. */
          message: string;
          /** The text for the save button Can use [channel] for the channel. */
          save: string;
          /** The text for the discard button Can use [channel] for the channel. */
          discard: string;
        };
  } & T;

  /** Configures the button at the bottom */
  cta: {
    /**
     * Null if we do not force the user to view every channel; otherwise, the
     * text on the button if clicking it will take them to the next channel
     */
    next: string | null;

    /** The text if the button is going to close the screen */
    final: string;

    /**
     * The transition to use if they press the button with the final text
     */
    exit: StandardScreenTransition;
  } & T;

  /**
   * Determines if we should use the standard bottom and top bar vs just
   * a back button
   */
  nav:
    | {
        /** just a back button */
        type: 'no-nav';
      }
    | {
        /** standard bottom and top bar */
        type: 'nav';

        /** The title of the screen in the top bar */
        title: string;

        /** For if the user taps the home button in the bottom bar */
        home: T;

        /** For if the user taps the series button in the bottom bar */
        series: T;
      };
};

export type ReminderTimesAPIParams = ReminderTimesParams<{
  trigger: ScreenConfigurableTriggerTransitioningPreferredAPI;
  triggerv75: ScreenConfigurableTriggerTransitioningTemporaryAPI;
}>;

export type ReminderTimesMappedParams = ReminderTimesParams<{
  trigger: ScreenConfigurableTrigger;
}> & {
  __mapped: true;
};
