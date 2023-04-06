import { OsehImageState } from '../../../../shared/OsehImage';

/**
 * The resources loaded for the signin reward component.
 */
export type SignupRewardResources = {
  /**
   * The users given name, null if the user is logged out or has not specified
   * a name.
   */
  givenName: string | null;

  /**
   * The full-bleed background image
   */
  background: OsehImageState | null;

  /**
   * True if we're still loading resources, false if we're ready to present.
   */
  loading: boolean;
};
