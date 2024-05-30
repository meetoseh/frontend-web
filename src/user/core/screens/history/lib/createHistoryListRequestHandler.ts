import { LoginContextValue } from '../../../../../shared/contexts/LoginContext';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { CancelablePromise } from '../../../../../shared/lib/CancelablePromise';
import {
  InfiniteListing,
  NetworkedInfiniteListing,
} from '../../../../../shared/lib/InfiniteListing';
import { RequestHandler, Result } from '../../../../../shared/requests/RequestHandler';
import { MinimalJourney, minimalJourneyKeyMap } from '../../../../favorites/lib/MinimalJourney';

const historyListRequest = Symbol('historyListRequest');
/** Branded type for history list request, since we dont want to use a plain object for typing */
export type HistoryListRequest = { __brand: typeof historyListRequest };
export const createHistoryListRequest = () => ({} as HistoryListRequest);

/**
 * Creates a request handler that can request the logged in users history
 * (what journeys they've taken)
 */
export const createHistoryListRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
  loginContextRaw,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
  loginContextRaw: LoginContextValue;
}): RequestHandler<HistoryListRequest, HistoryListRequest, InfiniteListing<MinimalJourney>> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef: getDataFromRef(loginContextRaw),
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: HistoryListRequest): string => 'historyListRequest';
const getDataFromRef = (
  loginContextRaw: LoginContextValue
): ((ref: HistoryListRequest) => CancelablePromise<Result<InfiniteListing<MinimalJourney>>>) =>
  createGetDataFromRefUsingSignal<HistoryListRequest, InfiniteListing<MinimalJourney>>({
    inner: async (ref, signal) => {
      const numVisible = 150;
      const result = new NetworkedInfiniteListing<MinimalJourney>(
        '/api/1/users/me/search_history',
        Math.min(numVisible * 2 + 10, 150),
        numVisible,
        10,
        {},
        [
          {
            key: 'last_taken_at',
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
              key: 'last_taken_at',
              dir: dir === 'before' ? 'asc' : 'desc',
              before: null,
              after: item.lastTakenAt === null ? null : item.lastTakenAt.getTime() / 1000,
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
const compareRefs = (a: HistoryListRequest, b: HistoryListRequest): number => 0;
