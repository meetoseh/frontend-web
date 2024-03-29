import { NetworkResponse } from '../../../../shared/hooks/useNetworkResponse';
import { OsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { StreakInfo } from '../../../journey/models/StreakInfo';
import { HomeScreenTransition } from './HomeScreen';

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
   * If specified, this is the transition that should be used when the user
   * enters the next time.
   */
  nextEnterTransition: HomeScreenTransition | undefined;

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

  /** Sets the transition to use next time the home screen is entered this session */
  setNextEnterTransition: (transition: HomeScreenTransition | undefined) => void;
};
