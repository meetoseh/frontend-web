import { InappNotification } from '../../../../shared/hooks/useInappNotification';

/** The channels the user can update the reminder times for */
export type Channel = 'email' | 'sms' | 'push';

/**
 * The state required to determine if we should show the introspection
 * prompt
 */
export type RequestNotificationTimeState = {
  /**
   * True if the user doesn't have a phone number and thus it doesn't make
   * sense to show this screen, false if they are logged in and have a phone
   * number, undefined if we don't know yet
   */
  missingPhone: boolean | undefined;

  /**
   * The in-app notification for this screen, or null if it hasn't been loaded yet
   */
  ian: InappNotification | null;

  /**
   * The channels the server wants us to update the settings for, null if the
   * server does not want us to update any settings, undefined if not logged in
   * or it doesn't matter (i.e., we don't bother determining this if we've
   * recently shown the screen)
   */
  serverWantsNotificationTime: Channel[] | null | undefined;

  /**
   * True if the client explicitly asked to update their notification times
   * via e.g. a button in settings, false otherwise
   */
  clientRequested: boolean;

  /**
   * Sets the clientRequested flag. Should be set to true if the user
   * clicks a button to update their notification time, and is
   * set to false whenever the user finishes updating their notification
   * times
   *
   * @param clientRequested the new value for the clientRequested flag
   */
  setClientRequested: (clientRequested: boolean) => void;
};
