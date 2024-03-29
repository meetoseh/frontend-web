import { InappNotification } from '../../../../shared/hooks/useInappNotification';

export type AgeForced = {
  /** The entrance transition */
  enter: 'swipe-left' | 'swipe-right' | 'fade';
};

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
   * Set if we are forcing this screen to be visible, null otherwise
   */
  forced: AgeForced | null;

  /**
   * The in-app notification for this screen, or null if it hasn't been loaded yet
   */
  ian: InappNotification | null;

  /**
   * Sets the value of `forced`
   */
  setForced: (forced: AgeForced | null) => void;
};
