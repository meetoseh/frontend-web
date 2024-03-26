import { InappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';

/**
 * The resources required to display the goal categories component
 */
export type GoalCategoriesResources = {
  /** True if more time is required before displaying the component, false otherwise */
  loading: boolean;

  /**
   * The in-app notification session, if it's been loaded, for this screen. Otherwise,
   * null
   */
  session: InappNotificationSession | null;

  /**
   * Callback for when the user wants to continue to the next screen; this will not
   * modify the inapp notification session.
   */
  onContinue: () => void;
};
