import { NetworkResponse } from '../../../../shared/hooks/useNetworkResponse';
import { StreakInfo } from '../../../journey/models/StreakInfo';

/**
 * Contains the state required to determine if the home screen
 * should be displayed, plus any additional state this screen
 * wants to share with other features.
 */
export type HomeScreenState = {
  /**
   * True if the feature flag for the new home screen is enabled, false otherwise.
   * This will be removed once the new home screen is fully launched.
   */
  enabled: boolean;

  /**
   * The users current streak info
   */
  streakInfo: NetworkResponse<StreakInfo>;
};
