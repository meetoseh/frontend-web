/**
 * Describes the state required to determine if we need to request a users
 * phone number.
 */
export type RequestPhoneState = {
  /**
   * True if the user has seen the first prompt to request their phone number
   * recently, false if they have not, undefined if not logged in.
   */
  sawInitialRequest: boolean | undefined;

  /**
   * True if the user has seen the second prompt to request their phone number
   * recently, false if they have not, undefined if not logged in.
   */
  sawSecondRequest: boolean | undefined;

  /**
   * Whether the user has a phone number associated with their account.
   */
  hasPhoneNumber: boolean | undefined;

  /**
   * A function which should be called if the user chooses not to give
   * us a phone number, so that we can update lastRequestAt.
   */
  onSkip: () => RequestPhoneState;
};
