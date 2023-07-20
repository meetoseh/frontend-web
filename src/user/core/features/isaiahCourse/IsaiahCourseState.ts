import { InappNotification } from '../../../../shared/hooks/useInappNotification';

/**
 * The state required to determine if we should show the days-per-week screen,
 * plus any state we might want to share.
 */
export type IsaiahCourseState = {
  /**
   * The in-app notification for this screen or null if it hasn't been loaded yet.
   */
  ian: InappNotification | null;

  /**
   * The users primary interest (from the interests context), or null if they don't
   * have one, or undefined if it's loading.
   */
  primaryInterest: string | null | undefined;

  /**
   * True if we've attached the course, false if we haven't, null if we're
   * trying to
   */
  attachedCourse: boolean | null;
};
