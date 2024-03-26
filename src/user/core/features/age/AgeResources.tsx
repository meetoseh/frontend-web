import { InappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';

/**
 * The resources required to display the age question component
 */
export type AgeResources = {
  /** True if more time is required before displaying the component, false otherwise */
  loading: boolean;

  /**
   * The in-app notification session, if it's been loaded, for this screen. Otherwise,
   * null
   */
  session: InappNotificationSession | null;

  /**
   * Callback for when the user wants to return to the previous screen; this will not
   * modify the inapp notification session.
   */
  onBack: () => void;

  /**
   * Callback for when the user wants to continue to the next screen; this will not
   * modify the inapp notification session.
   */
  onContinue: () => void;
};
