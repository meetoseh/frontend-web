/**
 * The state required to determine if we should show the introspection
 * prompt
 */
export type IntrospectionState = {
  /**
   * True if the user has not taken the onboarding flow yet,
   * false if they have, undefined if not logged in.
   */
  isRecentSignup: boolean | undefined;

  /**
   * True if the user has seen this introspection screen recently,
   * false if they have not, undefined if not logged in.
   */
  sawIntrospection: boolean | undefined;

  /**
   * If the user has seen the introspection screen recently, their response
   * (null if they skipped), otherwise undefined.
   */
  introspectionSelection: string | null | undefined;

  /**
   * A function to call if the user is presented the screen and they
   * skip/continue, so we store that they saw this screen.
   *
   * @param response The response the user gave, or null if they skipped.
   */
  onContinue: (response: string | null) => IntrospectionState;
};
