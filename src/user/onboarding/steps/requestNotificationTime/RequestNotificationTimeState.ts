import { InappNotification } from '../../../../shared/hooks/useInappNotification';

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
   * True if the server wants us to show the notification time screen,
   * false if it doesn't, undefined if not logged in or it doesn't matter
   * (i.e., we don't bother determining this if we've recently shown the
   * screen)
   */
  serverWantsNotificationTime: boolean | undefined;
};
