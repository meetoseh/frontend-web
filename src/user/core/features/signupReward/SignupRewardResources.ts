import { OsehImageState } from '../../../../shared/images/OsehImageState';
import { InappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';

/**
 * The resources loaded for the signin reward component.
 */
export type SignupRewardResources = {
  /**
   * The in-app notification session, if it's been loaded, for this screen. Otherwise,
   * null
   */
  session: InappNotificationSession | null;

  /**
   * The users given name, null if the user is logged out or has not specified
   * a name.
   */
  givenName: string | null;

  /**
   * The woman laughing image to show, or null if not loaded yet.
   */
  image: OsehImageState;

  /**
   * True if we're still loading resources, false if we're ready to present.
   */
  loading: boolean;
};
