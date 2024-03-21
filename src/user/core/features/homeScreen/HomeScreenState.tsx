import { NetworkResponse } from '../../../../shared/hooks/useNetworkResponse';
import { StreakInfo } from '../../../journey/models/StreakInfo';

export type HomeScreenSessionInfo = {
  /** The number of classes taken */
  classesTaken: number;
};

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

  /** Information about the users current session, i.e., since loading the page */
  sessionInfo: HomeScreenSessionInfo;

  /** Increments the number of classes taken this session */
  onClassTaken: () => void;
};
