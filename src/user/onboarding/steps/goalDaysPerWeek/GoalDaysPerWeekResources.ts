import { OsehImageState } from '../../../../shared/OsehImage';
import { InappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';

/**
 * The resources required to seamlessly load the goal days per week
 * screen.
 */
export type GoalDaysPerWeekResources = {
  /**
   * The in-app notification session for storing that the user saw this screen.
   */
  session: InappNotificationSession | null;

  /**
   * The background image for this screen, if available.
   */
  background: OsehImageState | null;

  /**
   * True if some resources are still being loaded, false if the screen is
   * ready to present.
   */
  loading: boolean;
};
