/**
 * The state required to determine if we should show the your journey screen.
 */
export type YourJourneyState = {
  /**
   * True if the user has not taken the onboarding flow yet,
   * false if they have, undefined if not logged in.
   */
  isRecentSignup: boolean | undefined;

  /**
   * True if the user has seen this screen recently,
   * false if they have not, undefined if not logged in.
   */
  sawYourJourney: boolean | undefined;

  /**
   * A function to call if the user is presented the screen and they
   * press the continue button, so that we store they saw the screen.
   */
  onContinue: () => YourJourneyState;
};
