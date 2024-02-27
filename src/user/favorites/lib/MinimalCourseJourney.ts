import { CrudFetcherMapper, convertUsingMapper } from '../../../admin/crud/CrudFetcher';
import { MinimalJourney, minimalJourneyKeyMap } from './MinimalJourney';

export type MinimalCourse = {
  /** The unique identifier for the course */
  uid: string;

  /** A JWT to access this course, with potentially varying access */
  jwt: string;

  /** The title of the course, in Title Case */
  title: string;

  /** When they liked the course, if they've liked it, otherwise null */
  likedAt: Date | null;
};

export const minimalCourseKeyMap: CrudFetcherMapper<MinimalCourse> = {
  liked_at: (_, v) => ({ key: 'likedAt', value: v ? new Date(v * 1000) : null }),
};

export type MinimalCourseJourney = {
  /** The unique identifier for the association between the course and journey */
  associationUid: string;
  /** The course the journey belongs to */
  course: MinimalCourse;
  /** The journey in the course */
  journey: MinimalJourney;
  /** Journeys with lower priority values are intended to be taken first */
  priority: number;
  /** When this user was added to this course */
  joinedCourseAt: Date | null;
  /** True if this is the next journey in the course for the user, false otherwise */
  isNext: boolean;
};

/**
 * The standard way to go from an api response to our internal representation
 * of a MinimalCourseJourney
 */
export const minimalCourseJourneyKeyMap: CrudFetcherMapper<MinimalCourseJourney> = {
  association_uid: 'associationUid',
  course: (_, v) => ({ key: 'course', value: convertUsingMapper(v, minimalCourseKeyMap) }),
  journey: (_, v) => ({
    key: 'journey',
    value: convertUsingMapper(v, minimalJourneyKeyMap),
  }),
  joined_course_at: (_, v) => ({
    key: 'joinedCourseAt',
    value: v === null || v === undefined ? null : new Date(v * 1000),
  }),
  is_next: 'isNext',
};
