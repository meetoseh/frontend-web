import { RequestHandler } from '../../../../../shared/requests/RequestHandler';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { LoginContextValueLoggedIn } from '../../../../../shared/contexts/LoginContext';
import { Identity } from '../../../features/settings/hooks/useIdentities';

/**
 * Creates a request handler for the identities the user can use to login
 */
export const createIdentitiesRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<LoginContextValueLoggedIn, LoginContextValueLoggedIn, Identity[]> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: LoginContextValueLoggedIn): string => ref.userAttributes.sub;
const getDataFromRef = createGetDataFromRefUsingSignal({
  inner: async (ref: LoginContextValueLoggedIn, signal): Promise<Identity[]> => {
    const resp = await apiFetch(
      '/api/1/users/me/search_identities',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          limit: 1000,
        }),
        signal,
      },
      ref
    );
    if (!resp.ok) {
      throw resp;
    }
    const data: { items: Identity[] } = await resp.json();
    return data.items;
  },
});
const compareRefs = (a: LoginContextValueLoggedIn, b: LoginContextValueLoggedIn): number =>
  getJwtExpiration(b.authTokens.idToken) - getJwtExpiration(a.authTokens.idToken);
