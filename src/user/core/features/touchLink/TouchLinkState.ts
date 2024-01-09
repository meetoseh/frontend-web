/**
 * The information returned about a link code from the backend
 */
export type TouchLinkInfo = {
  /**
   * The page the user should be brought to. Our supported values are:
   * - `home`: No additional behavior
   * - `unsubscribe`: The user should be unsubscribed from recurring emails
   *   and a confirmation should be shown
   */
  pageIdentifier: string;
  /**
   * Extra information based on the page. Currently unused.
   */
  pageExtra: Record<string, any>;
};

/**
 * The information this feature shares with other features.
 */
export type TouchLinkState = {
  /**
   * The link code that the user came from, null if they did not come from
   * a link code.
   */
  code: string | null;

  /**
   * If the code is set, this is the link info corresponding to the code,
   * or null if the code is invalid, or undefined if we're still fetching
   * the link info.
   *
   * If the code is not set, this is undefined.
   */
  linkInfo: TouchLinkInfo | null | undefined;

  /**
   * True if we've completed the standard analytics on the current link,
   * false otherwise.
   */
  linkAnalyticsDone: boolean;

  /**
   * A function which can be called if the links destination has been handled
   * by the user and we should remove it from storage.
   */
  handledLink: () => void;
};
