import { InappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';
import { OsehImageState } from '../../../../shared/images/OsehImageState';

export type IsaiahCourseResources = {
  /**
   * The in-app notification session for storing that the user saw this screen.
   */
  session: InappNotificationSession | null;

  /**
   * The background image for this screen
   */
  background: OsehImageState;

  /**
   * True if some resources are still being loaded, false if the screen is
   * ready to present.
   */
  loading: boolean;

  /**
   * Takes the user to their purchases page.
   */
  gotoPurchases: () => void;
};
