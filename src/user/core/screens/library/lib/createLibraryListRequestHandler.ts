import { LoginContextValueLoggedIn } from '../../../../../shared/contexts/LoginContext';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { createLoginContextValueFromInstance } from '../../../../../shared/lib/createLoginContextValueFromInstance';
import { getCurrentServerTimeMS } from '../../../../../shared/lib/getCurrentServerTimeMS';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import {
  InfiniteListing,
  NetworkedInfiniteListing,
} from '../../../../../shared/lib/InfiniteListing';
import { RequestHandler } from '../../../../../shared/requests/RequestHandler';
import { LibraryFilter, stableSerializeLibraryFilter } from './LibraryFilter';
import { SearchPublicJourney, searchPublicJourneyMapper } from './SearchPublicJourney';

/**
 * Describes a request for an object capable of listing public journeys filtered
 * according to the given filter.
 */
export type LibraryListRequest = {
  /** The logged in user */
  user: LoginContextValueLoggedIn;
  /** The filter to use */
  filter: LibraryFilter;
};

/** Minimal version of LibraryListRequest for refs */
export type LibraryListMinimalRequest = {
  /** The user the list is for */
  user: { userAttributes: { sub: string } };
  /** The filter on the list */
  filter: LibraryFilter;
};

export type LibraryListState = {
  /** The sub of the user this listing is for */
  userSub: string;

  /** The filter this list is using. Do not mutate. */
  filter: LibraryFilter;

  /** The underlying listing */
  listing: InfiniteListing<SearchPublicJourney>;

  /**
   * When this list state needs to get a new ref to be valid,
   * in milliseconds since the unix epoch on the servers clock
   */
  expiresAtServerMS: number;
};

/**
 * Creates a request handler for objects capable of listing public journeys
 * with a specific set of filters.
 */
export const createLibraryListRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<LibraryListMinimalRequest, LibraryListRequest, LibraryListState> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: LibraryListMinimalRequest): string =>
  `${ref.user.userAttributes.sub}-${stableSerializeLibraryFilter(ref.filter)}`;
const getDataFromRef = createGetDataFromRefUsingSignal<LibraryListRequest, LibraryListState>({
  inner: async (ref, signal) => {
    const numVisible = 150;

    const userTokenExpiresAtServer = getJwtExpiration(ref.user.authTokens.idToken);

    const nowServer = await getCurrentServerTimeMS();
    if (signal.aborted) {
      throw new Error('canceled');
    }

    const nowLocal = Date.now();
    const clockDrift = nowServer - nowLocal;
    const userTokenExpiresAtLocal = userTokenExpiresAtServer - clockDrift;

    const result = new NetworkedInfiniteListing<SearchPublicJourney>(
      '/api/1/journeys/search_public',
      Math.min(numVisible * 2 + 10, 150),
      numVisible,
      10,
      {
        ...(ref.filter.favorites === 'only'
          ? { liked_at: { operator: 'neq', value: null } }
          : undefined),
        ...(ref.filter.favorites === 'exclude'
          ? { liked_at: { operator: 'eq', value: null } }
          : undefined),
        ...(ref.filter.taken === 'only'
          ? { last_taken_at: { operator: 'neq', value: null } }
          : undefined),
        ...(ref.filter.taken === 'exclude'
          ? { last_taken_at: { operator: 'eq', value: null } }
          : undefined),
        ...(ref.filter.instructors.length > 0
          ? ({ instructor_uid_in: ref.filter.instructors } as any)
          : undefined),
      },
      [
        {
          key: 'title',
          dir: 'asc',
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
            key: 'title',
            dir: dir === 'before' ? 'desc' : 'asc',
            before: null,
            after: item.title,
          },
          {
            key: 'uid',
            dir: dir === 'before' ? 'desc' : 'asc',
            before: null,
            after: item.uid,
          },
        ];
      },
      searchPublicJourneyMapper,
      createLoginContextValueFromInstance({ user: ref.user, userTokenExpiresAtLocal })
    );
    result.reset();
    return {
      userSub: ref.user.userAttributes.sub,
      filter: ref.filter,
      listing: result,
      expiresAtServerMS: userTokenExpiresAtServer,
    };
  },
  isExpired: (ref, nowServer) => {
    const userExpiresAt = getJwtExpiration(ref.user.authTokens.idToken);
    return userExpiresAt <= nowServer;
  },
});
const compareRefs = (a: LibraryListRequest, b: LibraryListRequest): number =>
  getJwtExpiration(b.user.authTokens.idToken) - getJwtExpiration(a.user.authTokens.idToken);
