export type SeriesListForced = {
  /** The entrance transition */
  enter: 'swipe-left' | 'swipe-right' | 'fade';
};

/**
 * The minimum state required to determine if the series list screen should
 * be shown, plus any state we might want to share.
 */
export type SeriesListState = {
  /**
   * Set if the series tab wants to be shown, as indicated either by the
   * URL or by user action (which should then be reflected in the URL).
   */
  forced: SeriesListForced | null;

  /**
   * Sets the value of `forced`, usually because they either dismissed the
   * series screen or clicked to go to series.
   *
   * @param wantsSeries True if the series list should be shown, false if it
   *   should be hidden.
   * @param updateWindowHistory True if the window history should be updated to
   *   reflect the new value of wantsSeries, false to leave the window history
   *   alone.
   */
  setForced: (forced: SeriesListForced | null, updateWindowHistory: boolean) => void;
};
