import { OsehImageState } from '../../../../shared/OsehImage';
import { InappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';

export type FeedbackAnnouncementResources = {
  /**
   * The notification session for tracking, null if it's loading
   */
  session: InappNotificationSession | null;
  /**
   * The image to show in the announcement
   */
  image: OsehImageState;

  /**
   * True if time is still required to load all resources, false
   * if we're ready to display
   */
  loading: boolean;
};
