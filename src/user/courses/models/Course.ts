import { CrudFetcherKeyMap } from '../../../admin/crud/CrudFetcher';
import { OsehImageRef } from '../../../shared/OsehImage';

/**
 * A course that a user can enroll in. Typically paid, this is a programmed
 * sequence of journeys that make up a more concrete learning path.
 */
export type Course = {
  /**
   * Primary identifier for the course in api requests
   */
  uid: string;

  /**
   * An identifier that was selected for the course. This is unique,
   * and can be used to toggle functionality, but it's not necessarily
   * stable (i.e., the slug of a course may be changed)
   */
  slug: string;

  /**
   * The title for the course, to be used standalone
   */
  title: string;

  /**
   * The title of the course to be used mid-sentence.
   */
  titleShort: string;

  /**
   * An up to 250 character description of the course
   */
  description: string;

  /**
   * The full-bleed background image
   */
  backgroundImage: OsehImageRef;

  /**
   * The square image intended to be cropped to a circle
   */
  circleImage: OsehImageRef | null;
};

export const courseKeyMap: CrudFetcherKeyMap<Course> = {
  title_short: 'titleShort',
  background_image: 'backgroundImage',
  circle_image: 'circleImage',
};
