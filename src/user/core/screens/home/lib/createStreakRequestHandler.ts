import { RequestHandler } from '../../../../../shared/requests/RequestHandler';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import { LoginContextValueLoggedIn } from '../../../../../shared/contexts/LoginContext';
import { StreakInfo, streakInfoKeyMap } from '../../../../journey/models/StreakInfo';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { convertUsingMapper } from '../../../../../admin/crud/CrudFetcher';
import { apiFetch } from '../../../../../shared/ApiConstants';

/**
 * Creates a request handler for the users streak information.
 */
export const createStreakRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<LoginContextValueLoggedIn, StreakInfo> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: false },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: LoginContextValueLoggedIn): string => `${ref.userAttributes.sub}`;
const getDataFromRef = createGetDataFromRefUsingSignal({
  inner: async (ref: LoginContextValueLoggedIn, signal): Promise<StreakInfo> => {
    const resp = await apiFetch(
      '/api/1/users/me/streak',
      {
        method: 'GET',
        signal,
      },
      ref
    );
    if (!resp.ok) {
      throw resp;
    }
    const dataRaw: unknown = await resp.json();
    const data = convertUsingMapper(dataRaw, streakInfoKeyMap);
    return data;
  },
});

const compareRefs = (a: LoginContextValueLoggedIn, b: LoginContextValueLoggedIn): number =>
  getJwtExpiration(b.authTokens.idToken) - getJwtExpiration(a.authTokens.idToken);
