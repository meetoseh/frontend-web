import { InappNotification } from '../../../../shared/hooks/useInappNotification';

/**
 * The state required to determine if we should show the signup reward screen.
 */
export type SignupRewardState = {
  /**
   * The in-app notification for this screen, or null if it hasn't been loaded yet
   */
  signupIAP: InappNotification | null;
};
