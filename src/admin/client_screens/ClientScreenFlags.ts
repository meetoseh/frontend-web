export enum ClientScreenFlags {
  /**
   * UNSET to hide the screen by default in the admin area
   */
  SHOWS_IN_ADMIN = 1 << 0,

  /**
   * UNSET to automatically skip when peeked by the browser
   */
  SHOWS_ON_BROWSER = 1 << 1,

  /**
   * UNSET to automatically skip when peeked on ios
   */
  SHOWS_ON_IOS = 1 << 2,

  /**
   * UNSET to automatically skip when peeked on android
   */
  SHOWS_ON_ANDROID = 1 << 3,
}
