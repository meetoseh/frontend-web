import { CrudFetcherMapper, convertUsingKeymap } from '../../crud/CrudFetcher';
import { Journey } from '../../journeys/Journey';
import { keyMap as journeyKeyMap } from '../../journeys/Journeys';

export type CourseJourney = {
  /** The primary stable external identifier for this association */
  associationUid: string;

  /** The primary stable external identifier for the related course */
  courseUid: string;

  /** The related journey */
  journey: Journey;

  /**
   * The priority of the journey within the course. The (courseUid, priority) is
   * unique, and lower-valued priority journeys are shown first.
   */
  priority: number;
};

export const courseJourneyKeyMap: CrudFetcherMapper<CourseJourney> = {
  association_uid: 'associationUid',
  course_uid: 'courseUid',
  journey: (_, v) => ({ key: 'journey', value: convertUsingKeymap(v, journeyKeyMap) }),
};
