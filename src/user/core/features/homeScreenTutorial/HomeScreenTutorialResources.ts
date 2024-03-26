import { InappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';
import { NetworkResponse } from '../../../../shared/hooks/useNetworkResponse';
import { OsehImageState } from '../../../../shared/images/OsehImageState';
import { OsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { StreakInfo } from '../../../journey/models/StreakInfo';
import { HomeScreenSessionInfo } from '../homeScreen/HomeScreenState';

/**
 * Resources required to present the home screen tutorial
 */
export type HomeScreenTutorialResources = {
  /** True if this feature is ready to display its component, false otherwise */
  loading: boolean;

  /**
   * The in-app notification session, if it's been loaded, for this screen. Otherwise,
   * null
   */
  session: InappNotificationSession | null;

  /** The image handler for loading images */
  imageHandler: OsehImageStateRequestHandler;

  /** The users streak information */
  streakInfo: NetworkResponse<StreakInfo>;

  /** Information about the users current session, i.e., since loading the page */
  sessionInfo: HomeScreenSessionInfo;

  /** The background image for the top of the screen */
  backgroundImage: OsehImageState;
};
