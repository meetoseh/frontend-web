/**
 * The minimum state required to determine if the favorites screen should
 * be shown, plus any state we might want to share.
 */
export type FavoritesState = {
  /**
   * True if the favorites tab wants to be shown, as indicated either by the
   * URL or by user action (which should then be reflected in the URL).
   */
  show: boolean;

  /**
   * The tab that should be shown if the favorites tab is shown.
   */
  tab: 'favorites' | 'history' | 'courses';

  /**
   * Sets the value of `show`, usually because they either dismissed the
   * favorites screen or clicked to go to favorites.
   *
   * @param wantsFavorites True if the favorites tab should be shown, false if it
   *   should be hidden.
   * @param updateWindowHistory True if the window history should be updated to
   *   reflect the new value of wantsFavorites, false to leave the window history
   *   alone.
   */
  setShow: (wantsFavorites: boolean, updateWindowHistory: boolean) => void;

  /**
   * Sets the tab that would be should if the favorites tab is shown.
   *
   * @param tab The tab that should be shown if the favorites tab is shown.
   * @param updateWindowHistory True if the window history should be updated to
   *   reflect the new value of tab, false to leave the window history alone.
   */
  setTab: (tab: 'favorites' | 'history' | 'courses', updateWindowHistory: boolean) => void;
};
