import { LoginContextValue } from '../../../../../shared/contexts/LoginContext';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { CancelablePromise } from '../../../../../shared/lib/CancelablePromise';
import {
  InfiniteListing,
  NetworkedInfiniteListing,
} from '../../../../../shared/lib/InfiniteListing';
import { RequestHandler, Result } from '../../../../../shared/requests/RequestHandler';
import {
  MinimalCourseJourney,
  minimalCourseJourneyKeyMap,
} from '../../../../favorites/lib/MinimalCourseJourney';

const ownedListRequest = Symbol('ownedListRequest');
/** Branded type for history list request, since we dont want to use a plain object for typing */
export type OwnedListRequest = { __brand: typeof ownedListRequest };
export const createOwnedListRequest = () => ({} as OwnedListRequest);

/**
 * Creates a request handler that can request the logged in users purchased
 * content (attached series)
 */
export const createOwnedListRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
  loginContextRaw,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
  loginContextRaw: LoginContextValue;
}): RequestHandler<OwnedListRequest, OwnedListRequest, InfiniteListing<MinimalCourseJourney>> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef: getDataFromRef(loginContextRaw),
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: OwnedListRequest): string => 'ownedListRequest';
const getDataFromRef = (
  loginContextRaw: LoginContextValue
): ((ref: OwnedListRequest) => CancelablePromise<Result<InfiniteListing<MinimalCourseJourney>>>) =>
  createGetDataFromRefUsingSignal<OwnedListRequest, InfiniteListing<MinimalCourseJourney>>({
    inner: async (ref, signal) => {
      const numVisible = 150;
      const result = new NetworkedInfiniteListing<MinimalCourseJourney>(
        '/api/1/users/me/search_course_journeys',
        Math.min(numVisible * 2 + 10, 150),
        numVisible,
        10,
        {
          joined_course_at: {
            operator: 'neq',
            value: null,
          },
        },
        [
          {
            key: 'joined_course_at',
            dir: 'desc',
            before: null,
            after: null,
          },
          {
            key: 'course_uid',
            dir: 'asc',
            before: null,
            after: null,
          },
          {
            key: 'priority',
            dir: 'asc',
            before: null,
            after: null,
          },
          {
            key: 'association_uid',
            dir: 'asc',
            before: null,
            after: null,
          },
        ],
        (item, dir) => {
          return [
            {
              key: 'joined_course_at',
              dir: dir === 'before' ? 'asc' : 'desc',
              before: null,
              after: item.joinedCourseAt?.toLocaleString() ?? null,
            },
            {
              key: 'course_uid',
              dir: dir === 'before' ? 'desc' : 'asc',
              before: null,
              after: item.course.uid,
            },
            {
              key: 'priority',
              dir: dir === 'before' ? 'desc' : 'asc',
              before: null,
              after: item.priority,
            },
            {
              key: 'association_uid',
              dir: dir === 'before' ? 'desc' : 'asc',
              before: null,
              after: item.associationUid,
            },
          ];
        },
        minimalCourseJourneyKeyMap,
        loginContextRaw
      );
      result.reset();
      return result;
    },
  });
const compareRefs = (a: OwnedListRequest, b: OwnedListRequest): number => 0;
