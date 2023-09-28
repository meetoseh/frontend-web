export type LoginState = {
  /**
   * True if logging in is required, false if the user is already logged in.
   * Undefined if unsure because we are still loading the login state.
   */
  required?: boolean;
};
