/**
 * The information required to decide if the settings screen should be shown,
 * plus any additional information we want to share with other features.
 */
export type SettingsState = {
  /**
   * True if the settings screen wants to be shown, as indicated either by the
   * URL or by user action (which should then be reflected in the URL).
   */
  show: boolean;

  /**
   * Sets the value of `show`, usually because they either dismissed the
   * settings screen or clicked to go to settings.
   *
   * @param wantsSettings True if the settings screen should be shown, false if it
   *   should be hidden.
   * @param updateWindowHistory True if the window history should be updated to
   *   reflect the new value of wantsSettings, false to leave the window history
   *   alone.
   */
  setShow: (wantsSettings: boolean, updateWindowHistory: boolean) => void;
};
