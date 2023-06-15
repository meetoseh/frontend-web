import { InappNotification } from '../../../../shared/hooks/useInappNotification';

/**
 * The state required to determine if we should show the days-per-week screen,
 * plus any state we might want to share.
 */
export type GoalDaysPerWeekState = {
  /**
   * The in-app notification for this screen or null if it hasn't been loaded yet.
   */
  ian: InappNotification | null;
};
