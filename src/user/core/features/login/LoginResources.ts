/**
 * The implemented variants of the login screen
 */
export type LoginVariant = 'default' | 'isaiah';

/**
 * For now this is a basic shim to allow reusing the LoginApp which needs to be
 * usable outside of a feature context; if the downsides (such as the delayed
 * loading of the background image) become an issue, this could be adapted to
 * have its own login component and thus this could actually load all the
 * resources required
 */
export type LoginResources = {
  /**
   * True if we are still loading resources required for displaying the
   * login page, false otherwise
   */
  loading: boolean;

  /**
   * The login variant to use, if it has been loaded, otherwise undefined
   */
  variant: LoginVariant | undefined;
};
