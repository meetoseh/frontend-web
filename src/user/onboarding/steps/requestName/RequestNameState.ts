/**
 * The state required to determine if we should request the users name
 */
export type RequestNameState = {
  /**
   * The users given name, if specified. Null if the user is logged in and
   * has not specified a name, undefined if the user is not logged in.
   */
  givenName: string | null | undefined;
};
