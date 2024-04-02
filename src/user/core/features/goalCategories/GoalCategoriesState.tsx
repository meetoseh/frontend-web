import { InappNotification } from '../../../../shared/hooks/useInappNotification';

export type GoalCategoriesForced = {
  enter: 'swipe-left' | 'swipe-right' | 'fade';
};

/**
 * The information required to determine if the goal categories question should
 * be shown, plus any state we want to share with other features
 */
export type GoalCategoriesState = {
  /**
   * True if we are forcing this screen to be visible, false otherwise
   */
  forced: GoalCategoriesForced | null;

  /**
   * The in-app notification for this screen, or null if it hasn't been loaded yet
   */
  ian: InappNotification | null;

  /**
   * Sets the value of `forced`
   */
  setForced: (forced: GoalCategoriesForced | null) => void;
};
