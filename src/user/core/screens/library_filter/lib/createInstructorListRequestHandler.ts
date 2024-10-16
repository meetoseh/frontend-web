import { convertUsingMapper, CrudFetcherSort } from '../../../../../admin/crud/CrudFetcher';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { LoginContextValueLoggedIn } from '../../../../../shared/contexts/LoginContext';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import { RequestHandler } from '../../../../../shared/requests/RequestHandler';
import {
  SearchPublicInstructor,
  SearchPublicInstructorAPI,
  searchPublicInstructorMapper,
} from '../../library/lib/SearchPublicInstructor';

/**
 * Describes a request for an object capable of listing the instructors that
 * the user could filter to in the Classes tab (the library screen)
 */
export type InstructorListRequest = {
  /** The logged in user */
  user: LoginContextValueLoggedIn;
};

/** Minimal version of InstructorListRequest for refs */
export type InstructorListMinimalRequest = {
  /** The user the list is for */
  user: { userAttributes: { sub: string } };
};

export type InstructorListState = {
  /** The sub of the user this listing is for */
  userSub: string;

  /** The instructors in the list, in ascending order by name, then ascending order by uid */
  listing: SearchPublicInstructor[];

  /** When this list should be refreshed in server ms since the epoch */
  expiresAtServerMS: number;
};

/**
 * Creates a request handler for objects capable of listing instructors;
 * specifically, the instructors that should be shown in the library filter
 * screen.
 */
export const createInstructorListRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<InstructorListMinimalRequest, InstructorListRequest, InstructorListState> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: InstructorListMinimalRequest): string => ref.user.userAttributes.sub;
const getDataFromRef = createGetDataFromRefUsingSignal<InstructorListRequest, InstructorListState>({
  inner: async (ref, signal) => {
    const batchSize = 150;

    if (signal.aborted) {
      throw new Error('canceled');
    }

    const result: SearchPublicInstructor[] = [];
    let sort: CrudFetcherSort = [
      {
        key: 'name',
        dir: 'asc',
        before: null,
        after: null,
      },
    ];

    while (true) {
      const response = await apiFetch(
        '/api/1/instructors/search_public',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            sort,
            limit: batchSize,
          }),
          signal,
        },
        ref.user
      );
      if (!response.ok) {
        throw response;
      }
      const data: { items: SearchPublicInstructorAPI[]; next_page_sort?: CrudFetcherSort | null } =
        await response.json();
      result.push(...data.items.map((v) => convertUsingMapper(v, searchPublicInstructorMapper)));

      if (data.next_page_sort === null || data.next_page_sort === undefined) {
        break;
      }

      let haveMore = false;
      for (const searchValue of Object.values(data.next_page_sort)) {
        if (((searchValue as CrudFetcherSort[0]).after ?? null) !== null) {
          haveMore = true;
          break;
        }
      }

      if (!haveMore) {
        break;
      }

      sort = data.next_page_sort;
    }

    return {
      userSub: ref.user.userAttributes.sub,
      listing: result,
      expiresAtServerMS: getJwtExpiration(ref.user.authTokens.idToken),
    };
  },
  isExpired: (ref, nowServer) => {
    const userExpiresAt = getJwtExpiration(ref.user.authTokens.idToken);
    return userExpiresAt <= nowServer;
  },
});
const compareRefs = (a: InstructorListRequest, b: InstructorListRequest): number =>
  getJwtExpiration(b.user.authTokens.idToken) - getJwtExpiration(a.user.authTokens.idToken);
