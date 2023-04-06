/**
 * The state required to determine if we should show the introspection
 * prompt
 */
export type RequestNotificationTimeState = {
  /**
   * True if the user has seen this notification time screen recently,
   * false if they have not, undefined if not logged in.
   */
  sawNotificationTime: boolean | undefined;

  /**
   * If the user has seen the notification time screen recently, their response
   * (null if they skipped), otherwise undefined.
   */
  notificationTimeSelection: string | null | undefined;

  /**
   * True if the server wants us to show the notification time screen,
   * false if it doesn't, undefined if not logged in or it doesn't matter
   * (i.e., we don't bother determining this if we've recently shown the
   * screen)
   */
  serverWantsNotificationTime: boolean | undefined;

  /**
   * A function to call if the user is presented the screen and they
   * skip/continue, so we store that they saw this screen.
   *
   * @param response The response the user gave, or null if they skipped.
   */
  onContinue: (response: string | null) => RequestNotificationTimeState;
};
