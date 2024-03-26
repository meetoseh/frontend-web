import { InappNotification } from '../../../../shared/hooks/useInappNotification';

/**
 * The information required to determine if the age question should
 * be shown, plus any state we want to share with other features
 */
export type AgeState = {
  /**
   * True if this feature is enabled (by flag), false if disabled, null if unsure.
   * This will be removed once the feature is fully launched.
   */
  enabled: boolean | null;

  /**
   * True if we are forcing this screen to be visible, false otherwise
   */
  forced: boolean;

  /**
   * The in-app notification for this screen, or null if it hasn't been loaded yet
   */
  ian: InappNotification | null;

  /**
   * Sets the value of `forced`
   */
  setForced: (forced: boolean) => void;
};
