import { convertUsingMapper } from '../../../admin/crud/CrudFetcher';
import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContextValue } from '../../../shared/contexts/LoginContext';
import { createGetDataFromRefUsingSignal } from '../../../shared/images/createGetDataFromRefUsingSignal';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { getJwtExpiration } from '../../../shared/lib/getJwtExpiration';
import { RequestHandler, Result } from '../../../shared/requests/RequestHandler';
import { CourseRef } from '../../favorites/lib/CourseRef';
import {
  MinimalCourseJourney,
  minimalCourseJourneyKeyMap,
} from '../../favorites/lib/MinimalCourseJourney';

/**
 * Whats fetched from the server when we want to get the journeys for a course.
 * We wrap the list in case we add more things later
 */
export type CourseJourneys = {
  /** The journeys in the course */
  journeys: MinimalCourseJourney[];
};

/**
 * Creates an object capable of converting a course ref into the journeys for that course.
 */
export const createSeriesJourneysRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
  loginContextRaw,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
  loginContextRaw: LoginContextValue;
}): RequestHandler<{ uid: string }, CourseRef, CourseJourneys> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef: getDataFromRef(loginContextRaw),
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: { uid: string }): string => ref.uid;
const getDataFromRef = (
  loginContextRaw: LoginContextValue
): ((ref: CourseRef) => CancelablePromise<Result<CourseJourneys>>) =>
  createGetDataFromRefUsingSignal({
    inner: async (ref, signal) => {
      const loginContext = loginContextRaw.value.get();
      if (loginContext.state !== 'logged-in') {
        throw new Error('not logged in');
      }

      const response = await apiFetch(
        '/api/1/users/me/search_course_journeys?course_jwt=' + ref.jwt,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            sort: [{ key: 'priority', dir: 'asc' }],
            limit: 150,
          }),
          signal,
        },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      const data: { items: any[] } = await response.json();
      const journeys = data.items.map((itm) => convertUsingMapper(itm, minimalCourseJourneyKeyMap));
      return { journeys };
    },
    isExpired: (ref, nowServer) => getJwtExpiration(ref.jwt) < nowServer,
  });
const compareRefs = (a: CourseRef, b: CourseRef): number =>
  getJwtExpiration(b.jwt) - getJwtExpiration(a.jwt);
