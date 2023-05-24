import { OsehImageState } from '../../../../shared/OsehImage';
import { InappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';
import { JourneyShared } from '../../../journey/models/JourneyShared';

/**
 * The information required to present the prompt without any spinners
 */
export type TryAIJourneyResources = {
  /**
   * The in-app notification session, if it's been loaded, for this screen. Otherwise,
   * null
   */
  session: InappNotificationSession | null;

  /**
   * The background image to use for the question of if they want to start the
   * journey, or null if it's still loading
   */
  promptBackground: OsehImageState | null;

  /**
   * The shared journey state of the journey being started
   */
  shared: JourneyShared;

  /**
   * True if we're still loading resources, false if we're ready to present.
   */
  loading: boolean;
};
