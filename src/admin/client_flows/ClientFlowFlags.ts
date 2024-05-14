export enum ClientFlowFlags {
  /**
   * UNSET to hide the flow by default in the admin area
   */
  SHOWS_IN_ADMIN = 1 << 0,

  /**
   * UNSET to prevent deleting and changing the slug
   */
  IS_CUSTOM = 1 << 1,

  /**
   * UNSET to replace this trigger with `forbidden` on iOS
   */
  IOS_TRIGGERABLE = 1 << 2,

  /**
   * UNSET to replace this trigger with `forbidden` on Android
   */
  ANDROID_TRIGGERABLE = 1 << 3,

  /**
   * UNSET to replace this trigger with `forbidden` on the web
   */
  BROWSER_TRIGGERABLE = 1 << 4,
}
