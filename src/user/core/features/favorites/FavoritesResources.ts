import { OsehImageState } from '../../../../shared/images/OsehImageState';

/**
 * The resources required to display favorites
 */
export type FavoritesResources = {
  /**
   * The background image for this screen
   */
  background: OsehImageState;

  /**
   * True if some resources are still being loaded, false if the screen is
   * ready to present.
   */
  loading: boolean;
};
