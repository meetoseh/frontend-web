/**
 * The state required to decide of the share journey feature should
 * be shown and what it shares with other features.
 */
export type ShareJourneyState = {
  /**
   * True if we're still deciding if we should redirect, false if we decided
   * not to redirect
   */
  loading: boolean;

  /**
   * Used internally within the feature to set loading, since we can't decide
   * if we're loading without the state from the touch link feature, which we
   * don't get access to until we're loading resources
   *
   * @param loading the new value for loading
   */
  setLoading: (loading: boolean) => void;
};
