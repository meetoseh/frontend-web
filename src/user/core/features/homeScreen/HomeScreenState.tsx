import { NetworkResponse } from '../../../../shared/hooks/useNetworkResponse';
import { OsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
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
   * The image handler, which we expose here for the home screen tutorial
   * since it will essentially load the same assets, and this allows them
   * to be reused here.
   */
  imageHandler: OsehImageStateRequestHandler;

  /**
   * The users current streak info
   */
  streakInfo: NetworkResponse<StreakInfo>;

  /** Information about the users current session, i.e., since loading the page */
  sessionInfo: HomeScreenSessionInfo;

  /** Increments the number of classes taken this session */
  onClassTaken: () => void;
};
