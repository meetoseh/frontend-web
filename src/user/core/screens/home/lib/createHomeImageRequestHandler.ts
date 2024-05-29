import { RequestHandler } from '../../../../../shared/requests/RequestHandler';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { SessionStateSnapshot } from './createSessionStateRequestHandler';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { OsehImageRef } from '../../../../../shared/images/OsehImageRef';

export type HomeImage = {
  /** The image to show */
  image: OsehImageRef;
  /** The thumbhash for the image at a typical resolution */
  thumbhash: string;
};

/**
 * Creates a request handler for the home image for a user based on their
 * session info
 */
export const createHomeImageRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<SessionStateSnapshot, HomeImage> => {
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
  inner: async (ref: SessionStateSnapshot, signal): Promise<HomeImage> => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/Los_Angeles';
    const resp = await apiFetch(
      '/api/1/users/me/home_image?variant=' +
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
    const data: HomeImage = await resp.json();
    return data;
  },
});
const compareRefs = (a: SessionStateSnapshot, b: SessionStateSnapshot): number =>
  getJwtExpiration(b.loginContext.authTokens.idToken) -
  getJwtExpiration(a.loginContext.authTokens.idToken);
