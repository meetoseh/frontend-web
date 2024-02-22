export type SeriesListResources = {
  /**
   * True if some resources are still being loaded, false if the screen is
   * ready to present.
   */
  loading: boolean;

  /**
   * The function to call if the user requests to go to their
   * account/settings page
   */
  gotoSettings: () => void;
};
