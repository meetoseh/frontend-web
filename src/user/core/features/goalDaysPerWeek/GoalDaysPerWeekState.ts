import { InappNotification } from '../../../../shared/hooks/useInappNotification';

export type GoalDaysPerWeekForced = {
  /** If a back button should be rendered, where it should go */
  back: 'age' | null;
};

/**
 * The state required to determine if we should show the days-per-week screen,
 * plus any state we might want to share.
 */
export type GoalDaysPerWeekState = {
  /**
   * The in-app notification for this screen or null if it hasn't been loaded yet.
   */
  ian: InappNotification | null;

  /**
   * Set if this screen should be shown because of direct user request, unset
   * otherwise
   */
  forced: GoalDaysPerWeekForced | null;

  /** Sets the current value of forced */
  setForced: (forced: GoalDaysPerWeekForced | null) => void;
};
