import { RequestHandler } from '../../../../../shared/requests/RequestHandler';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { SessionStateSnapshot } from './createSessionStateRequestHandler';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';

export type HomeCopy = {
  /** The headline text */
  headline: string;
  /** The smaller, subheadline text */
  subheadline: string;
};

/**
 * Creates a request handler for the home copy for a user based on their
 * session info
 */
export const createHomeCopyRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<SessionStateSnapshot, SessionStateSnapshot, HomeCopy> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: SessionStateSnapshot): string =>
  `${ref.loginContext.userAttributes.sub}:${ref.takenAClass}`;
const getDataFromRef = createGetDataFromRefUsingSignal({
  inner: async (ref: SessionStateSnapshot, signal): Promise<HomeCopy> => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/Los_Angeles';
    const resp = await apiFetch(
      '/api/1/users/me/home_copy?variant=' +
        encodeURIComponent(ref.takenAClass ? 'session_end' : 'session_start') +
        '&tz=' +
        encodeURIComponent(tz) +
        '&tzt=' +
        encodeURIComponent('browser'),
      {
        method: 'GET',
        signal,
      },
      ref.loginContext
    );
    if (!resp.ok) {
      throw resp;
    }
    const data: HomeCopy = await resp.json();
    return data;
  },
});
const compareRefs = (a: SessionStateSnapshot, b: SessionStateSnapshot): number =>
  getJwtExpiration(b.loginContext.authTokens.idToken) -
  getJwtExpiration(a.loginContext.authTokens.idToken);
