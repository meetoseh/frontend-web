import { RequestHandler } from '../../../../../shared/requests/RequestHandler';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { LoginContextValueLoggedIn } from '../../../../../shared/contexts/LoginContext';

export type MembershipUrl = {
  /** The actual url */
  url: string;

  /** When this url is expected to expire in local time */
  expiresAt: Date;
};

/**
 * Creates a request handler for the home copy for a user based on their
 * session info
 */
export const createManageMembershipUrlRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<LoginContextValueLoggedIn, LoginContextValueLoggedIn, MembershipUrl> => {
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
  inner: async (ref: LoginContextValueLoggedIn, signal): Promise<MembershipUrl> => {
    const resp = await apiFetch(
      '/api/1/users/me/stripe/customer_portal',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ return_path: '/settings/manage-membership?sync=1' }),
        signal,
      },
      ref
    );
    if (!resp.ok) {
      throw resp;
    }
    const data: { url: string } = await resp.json();
    return {
      url: data.url,
      expiresAt: new Date(Date.now() + 1000 * 60 * 10),
    };
  },
});
const compareRefs = (a: LoginContextValueLoggedIn, b: LoginContextValueLoggedIn): number =>
  getJwtExpiration(b.authTokens.idToken) - getJwtExpiration(a.authTokens.idToken);
