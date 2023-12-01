import { InappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';

/**
 * The resources required to actually display the feature
 */
export type ConfirmMergeAccountResources = {
  /**
   * The in-app notification session for logging or null if still loading
   */
  session: InappNotificationSession | null;

  /**
   * True if we are still loading resources required to show the
   * component, false otherwise
   */
  loading: boolean;

  /**
   * Can be called to request when the user would like to be notified
   * from available channels.
   */
  requestNotificationTimes: () => void;
};
