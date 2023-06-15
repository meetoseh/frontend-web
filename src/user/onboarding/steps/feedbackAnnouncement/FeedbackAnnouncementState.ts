import { InappNotification } from '../../../../shared/hooks/useInappNotification';

/**
 * The state requires to determine if the feedback announcement should be shown,
 * plus any state we want to share with other steps
 */
export type FeedbackAnnouncementState = {
  /**
   * The inapp notification information or null if it's still loading
   */
  ian: InappNotification | null;
};
