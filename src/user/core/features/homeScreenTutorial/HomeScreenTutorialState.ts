import { InappNotification } from '../../../../shared/hooks/useInappNotification';

/**
 * The state required to determine if the home screen tutorial should
 * be shown, plus any additional state we want to share with other
 * features
 */
export type HomeScreenTutorialState = {
  /**
   * True if the feature flag for the new home screen is enabled, false otherwise.
   * This will be removed once the new home screen is fully launched. null if
   * still determining if the feature is enabled.
   */
  enabled: boolean | null;

  /**
   * The in-app notification for this screen, or null if it hasn't been loaded yet
   */
  ian: InappNotification | null;
};
