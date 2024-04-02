import { InappNotification } from '../../../../shared/hooks/useInappNotification';

/**
 * The state required to determine if the home screen tutorial should
 * be shown, plus any additional state we want to share with other
 * features
 */
export type HomeScreenTutorialState = {
  /**
   * The in-app notification for this screen, or null if it hasn't been loaded yet
   */
  ian: InappNotification | null;
};
