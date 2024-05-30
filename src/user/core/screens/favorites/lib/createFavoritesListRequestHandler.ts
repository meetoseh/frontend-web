import { LoginContextValue } from '../../../../../shared/contexts/LoginContext';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { CancelablePromise } from '../../../../../shared/lib/CancelablePromise';
import {
  InfiniteListing,
  NetworkedInfiniteListing,
} from '../../../../../shared/lib/InfiniteListing';
import { RequestHandler, Result } from '../../../../../shared/requests/RequestHandler';
import { MinimalJourney, minimalJourneyKeyMap } from '../../../../favorites/lib/MinimalJourney';

const favoritesListRequest = Symbol('favoritesListRequest');
/** Branded type for favorites list request, since we dont want to use a plain object for typing */
export type FavoritesListRequest = { __brand: typeof favoritesListRequest };
export const createFavoritesListRequest = () => ({} as FavoritesListRequest);

/**
 * Creates a request handler that can request the logged in users favorite
 * classes.
 */
export const createFavoritesListRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
  loginContextRaw,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
  loginContextRaw: LoginContextValue;
}): RequestHandler<FavoritesListRequest, FavoritesListRequest, InfiniteListing<MinimalJourney>> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef: getDataFromRef(loginContextRaw),
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: FavoritesListRequest): string => 'favoritesListRequest';
const getDataFromRef = (
  loginContextRaw: LoginContextValue
): ((ref: FavoritesListRequest) => CancelablePromise<Result<InfiniteListing<MinimalJourney>>>) =>
  createGetDataFromRefUsingSignal<FavoritesListRequest, InfiniteListing<MinimalJourney>>({
    inner: async (ref, signal) => {
      const numVisible = 150;
      const result = new NetworkedInfiniteListing<MinimalJourney>(
        '/api/1/users/me/search_history',
        Math.min(numVisible * 2 + 10, 150),
        numVisible,
        10,
        {
          liked_at: {
            operator: 'neq',
            value: null,
          },
        },
        [
          {
            key: 'liked_at',
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
              key: 'liked_at',
              dir: dir === 'before' ? 'asc' : 'desc',
              before: null,
              after: item.likedAt === null ? null : item.likedAt.getTime() / 1000,
            },
            {
              key: 'uid',
              dir: dir === 'before' ? 'desc' : 'asc',
              before: null,
              after: item.uid,
            },
          ];
        },
        minimalJourneyKeyMap,
        loginContextRaw
      );
      result.reset();
      return result;
    },
  });
const compareRefs = (a: FavoritesListRequest, b: FavoritesListRequest): number => 0;
