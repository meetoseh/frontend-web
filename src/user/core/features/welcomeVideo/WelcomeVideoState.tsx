import { InappNotification } from '../../../../shared/hooks/useInappNotification';

/**
 * The information required to determine if the welcome video should be shown,
 * plus any state we want to share with other features
 */
export type WelcomeVideoState = {
  /**
   * True if the feature flag for the new welcome video, false otherwise.
   * Null if still unsure. This will be removed once the new welcome video is
   * fully launched.
   */
  enabled: boolean | null;

  /**
   * The in-app notification for this screen, or null if it hasn't been loaded yet
   */
  ian: InappNotification | null;
};
