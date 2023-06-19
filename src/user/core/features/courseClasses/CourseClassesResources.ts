import { OsehImageState } from '../../../../shared/images/OsehImageState';
import { JourneyRef } from '../../../journey/models/JourneyRef';
import { JourneyShared } from '../../../journey/models/JourneyShared';

/**
 * Information required to render the course classes component immediately.
 */
export type CourseClassesResources = {
  /**
   * The journey that is next-in-sequence, null if it hasn't been loaded yet
   */
  journey: JourneyRef | null;

  /**
   * The loaded resources for the journey, null if it hasn't been loaded yet
   */
  journeyShared: JourneyShared | null;

  /**
   * The background to use for the start screen, null if it hasn't been loaded
   * yet.
   */
  startBackground: OsehImageState;

  /**
   * The square image intended to be cropped to a circle and is used
   * to identify the course, null if it either hasn't been loaded yet
   * or the course doesn't have such an image.
   */
  courseCircle: OsehImageState;

  /**
   * True if some resources are still being loaded, false otherwise
   */
  loading: boolean;
};
