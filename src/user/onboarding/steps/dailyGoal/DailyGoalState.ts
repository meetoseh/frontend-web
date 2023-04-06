/**
 * Contains everything required to know if we should render the daily
 * goal interactive prompt
 */
export type DailyGoalState = {
  /**
   * True if the user has not taken the onboarding flow yet,
   * false if they have, undefined if not logged in.
   */
  isRecentSignup: boolean | undefined;

  /**
   * True if the user has seen this daily goal screen recently,
   * false if they have not, undefined if not logged in.
   */
  sawDailyGoal: boolean | undefined;

  /**
   * If the user has seen the daily goal screen recently, their response
   * (null if they skipped), otherwise undefined.
   */
  dailyGoalSelection: string | null | undefined;

  /**
   * If the user is currently seeing the daily goal screen, the
   * response they have selected so far, otherwise undefined. This
   * is used by the onboarding class to decide which class to prepare.
   */
  anticipatedDailyGoalSelection: string | null | undefined;

  /**
   * Should be called when the daily goal screen is presented, whenever
   * the user changes their selection.
   * @param response The users current response.
   */
  onSelection: (response: string | null) => void;

  /**
   * A function to call if the user is presented the screen and they
   * skip/continue, so we store that they saw this screen.
   *
   * @param response The response the user gave, or null if they skipped.
   */
  onContinue: (response: string | null) => DailyGoalState;
};
