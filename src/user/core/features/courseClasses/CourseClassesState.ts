import { Course } from '../../../courses/models/Course';
import { JourneyRef } from '../../../journey/models/JourneyRef';

/**
 * The information required to determine if course classes should be shown to the
 * user, plus any callbacks or shared state.
 */
export type CourseClassesState = {
  /**
   * The next course we should show the user, null if there are no more courses,
   * and undefined if we haven't loaded the next course yet.
   */
  course: Course | null | undefined;

  /**
   * True if there was a course for them to take today, false if there was not.
   * Intended to be used for other features to tweak copy.
   */
  tookCourse: boolean;

  /**
   * Should be called when the user completes the given journey in the given
   * course, so that their progress can be advanced and the prompt won't be
   * displayed until the next class is available.
   *
   * @param course The course within which the journey was taken
   * @param journey The journey that was taken
   */
  onDone: (course: Course, journey: JourneyRef) => void;

  /**
   * Should be called if the user doesn't want to take the next
   * journey in the given course today. Suppresses the prompt on
   * this device for the next 24 hours, without advancing the
   * user's progress.
   *
   * @param course The course that the user wants to skip
   */
  onSkip: (course: Course) => void;
};
