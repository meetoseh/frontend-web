import { CrudFetcherKeyMap, convertUsingKeymap } from '../../../admin/crud/CrudFetcher';
import { MinimalJourney, minimalJourneyKeyMap } from './MinimalJourney';

export type MinimalCourse = {
  /** The unique identifier for the course */
  uid: string;

  /** The title of the course, in Title Case */
  title: string;
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
  joinedCourseAt: Date;
  /** True if this is the next journey in the course for the user, false otherwise */
  isNext: boolean;
};

/**
 * The standard way to go from an api response to our internal representation
 * of a MinimalCourseJourney
 */
export const minimalCourseJourneyKeyMap:
  | CrudFetcherKeyMap<MinimalCourseJourney>
  | ((v: any) => MinimalCourseJourney) = {
  association_uid: 'associationUid',
  journey: (_, v) => ({
    key: 'journey',
    value:
      typeof minimalJourneyKeyMap === 'function'
        ? minimalJourneyKeyMap(v)
        : convertUsingKeymap(v, minimalJourneyKeyMap),
  }),
  joined_course_at: (_, v) => ({ key: 'joinedCourseAt', value: new Date(v * 1000) }),
  is_next: 'isNext',
};
