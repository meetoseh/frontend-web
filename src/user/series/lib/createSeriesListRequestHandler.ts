import { LoginContextValue } from '../../../shared/contexts/LoginContext';
import { createGetDataFromRefUsingSignal } from '../../../shared/images/createGetDataFromRefUsingSignal';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { InfiniteListing, NetworkedInfiniteListing } from '../../../shared/lib/InfiniteListing';
import { RequestHandler, Result } from '../../../shared/requests/RequestHandler';
import { ExternalCourse, externalCourseKeyMap } from './ExternalCourse';

const seriesListRequest = Symbol('seriesListRequest');
/** Branded type for series list request, since we dont want to use a plain object for typing */
export type SeriesListRequest = { __brand: typeof seriesListRequest };
export const createSeriesListRequest = () => ({} as SeriesListRequest);

/**
 * Creates a request handler that can request a list of series. A request
 * handler is a very overkill interface for what is essentially a singleton, but
 * given that its implemented anyway it's a very convenient way to initialize the
 * series list only if we actually expect to use it.
 */
export const createSeriesListRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
  loginContextRaw,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
  loginContextRaw: LoginContextValue;
}): RequestHandler<SeriesListRequest, SeriesListRequest, InfiniteListing<ExternalCourse>> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef: getDataFromRef(loginContextRaw),
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: SeriesListRequest): string => 'seriesListRequest';
const getDataFromRef = (
  loginContextRaw: LoginContextValue
): ((ref: SeriesListRequest) => CancelablePromise<Result<InfiniteListing<ExternalCourse>>>) =>
  createGetDataFromRefUsingSignal<SeriesListRequest, InfiniteListing<ExternalCourse>>({
    inner: async (ref, signal) => {
      const numVisible = 15;
      const result = new NetworkedInfiniteListing<ExternalCourse>(
        '/api/1/courses/search_public?category=list',
        Math.min(numVisible * 2 + 10, 50),
        numVisible,
        10,
        {},
        [
          {
            key: 'created_at',
            dir: 'desc',
            before: null,
            after: null,
          },
          {
            key: 'uid',
            dir: 'asc',
            before: null,
            after: null,
          },
        ],
        (item, dir) => {
          return [
            {
              key: 'created_at',
              dir: dir === 'before' ? 'asc' : 'desc',
              before: null,
              after: item.createdAt === null ? null : item.createdAt.getTime() / 1000,
            },
            {
              key: 'uid',
              dir: dir === 'before' ? 'desc' : 'asc',
              before: null,
              after: item.uid,
            },
          ];
        },
        externalCourseKeyMap,
        loginContextRaw
      );
      result.reset();
      return result;
    },
  });
const compareRefs = (a: SeriesListRequest, b: SeriesListRequest): number => 0;
