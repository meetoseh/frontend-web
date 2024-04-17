import { OsehImageState } from '../../../../shared/images/OsehImageState';
import { OsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { UseCourseLikeStateResult } from '../../../favorites/hooks/useCourseLikeState';
import { MinimalCourse, MinimalCourseJourney } from '../../../favorites/lib/MinimalCourseJourney';
import { JourneyRef } from '../../../journey/models/JourneyRef';
import { ExternalCoursePreviewable } from '../../../series/lib/ExternalCourse';

export type SeriesDetailsResources = {
  /**
   * True if some resources are still being loaded, false if the screen is
   * ready to present.
   */
  loading: boolean;

  /**
   * The background image to use.
   */
  backgroundImage: OsehImageState;

  /**
   * The image handler we use for series details; by storing this here,
   * we can more quickly load the page when the user navigates back to it.
   */
  imageHandler: OsehImageStateRequestHandler;

  /**
   * Whether or not the course is liked
   */
  courseLikeState: UseCourseLikeStateResult;

  /**
   * The classes in the shown series, if known. Undefined if still loading,
   * null if an error occurred that prevented us from loading the classes.
   */
  journeys: MinimalCourseJourney[] | null | undefined;

  /**
   * Can be called to return to the "previous" screen
   */
  goBack: () => void;

  /** Go to the course preview for the given course */
  gotoCoursePreview: (course: ExternalCoursePreviewable) => void;

  /**
   * Can be called to show the course feature for the journey with
   * the given ref. This is presumably called when a user with the entitlement
   * clicks on a journey in the series details screen. The steps to get the ref
   * would be:
   *
   * - attach the series, if not already attached (`joinedCourseAt === null`,
   *   `/api/1/courses/attach_via_jwt`)
   * - fetch the journey ref `/api/1/courses/start_journey`
   *
   * If the user makes it to actually playing the audio of the class, this will
   * call `/api/1/courses/advance` to record their progress.
   *
   * @param journey The journey to show
   * @param course The course that the journey is in
   */
  gotoJourney: (journey: JourneyRef, course: MinimalCourse) => void;

  /**
   * Goes to the upgrade screen, presumably because the user clicked on
   * the Unlock with Oseh+ button
   */
  gotoUpgrade: () => void;
};
