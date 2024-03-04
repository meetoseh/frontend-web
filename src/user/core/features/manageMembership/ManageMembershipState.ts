/**
 * The information required to determine if the manage membership feature
 * should be shown, plus anything we want to share with other features.
 */
export type ManageMembershipState = {
  /** True if this feature wants to be shown, false if it doesn't, undefined if still being determined */
  show: boolean | undefined;

  /**
   * Updates show to reflect the new value. Cannot be called
   * while `show` is undefined
   *
   * @param show If the feature should be shown
   * @param updateWindowHistory True to push new state to the window history,
   *   false not to
   */
  setShow: (show: boolean, updateWindowHistory: boolean) => void;
};
