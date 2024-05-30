import { RequestHandler } from '../../../../../shared/requests/RequestHandler';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { LoginContextValueLoggedIn } from '../../../../../shared/contexts/LoginContext';
import { OsehImageRef } from '../../../../../shared/images/OsehImageRef';

export type OptionalOsehImageRef =
  | { type: 'available'; data: OsehImageRef }
  | { type: 'unavailable'; data: undefined };

/**
 * Creates a request handler for the users profile picture, if any
 */
export const createProfilePictureRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<LoginContextValueLoggedIn, LoginContextValueLoggedIn, OptionalOsehImageRef> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: LoginContextValueLoggedIn): string => `${ref.userAttributes.sub}`;
const getDataFromRef = createGetDataFromRefUsingSignal({
  inner: async (ref: LoginContextValueLoggedIn, signal): Promise<OptionalOsehImageRef> => {
    const resp = await apiFetch(
      '/api/1/users/me/picture',
      {
        method: 'GET',
        signal,
      },
      ref
    );
    if (!resp.ok) {
      if (resp.status === 404) {
        return { type: 'unavailable', data: undefined };
      }
      throw resp;
    }
    const data: OsehImageRef = await resp.json();
    return { type: 'available', data };
  },
});
const compareRefs = (a: LoginContextValueLoggedIn, b: LoginContextValueLoggedIn): number =>
  getJwtExpiration(b.authTokens.idToken) - getJwtExpiration(a.authTokens.idToken);
