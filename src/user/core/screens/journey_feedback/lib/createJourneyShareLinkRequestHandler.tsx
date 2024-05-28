import { apiFetch } from '../../../../../shared/ApiConstants';
import { LoginContextValue } from '../../../../../shared/contexts/LoginContext';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { RequestHandler } from '../../../../../shared/requests/RequestHandler';
import { JourneyMinimalRef } from './JourneyMinimalRef';

export type JourneyShareLink = {
  /** Either the link to share with or null if the journey is not shareable */
  link: string | null;
};

/**
 * Creates a request handler capable of generating share links for journeys
 */
export const createJourneyShareLinkRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
  loginContextRaw,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
  loginContextRaw: LoginContextValue;
}): RequestHandler<JourneyMinimalRef, JourneyShareLink> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef: getDataFromRef(loginContextRaw),
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: JourneyMinimalRef): string => ref.uid;
const getDataFromRef = (loginContextRaw: LoginContextValue) =>
  createGetDataFromRefUsingSignal({
    inner: async (ref: JourneyMinimalRef, signal): Promise<JourneyShareLink> => {
      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        throw new Error('not logged in');
      }

      const loginContext = loginContextUnch;
      const resp = await apiFetch(
        '/api/1/journeys/create_share_link',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ uid: ref.uid }),
          signal,
        },
        loginContext
      );
      if (!resp.ok) {
        if (resp.status === 404 || resp.status === 409) {
          return { link: null };
        }
        throw resp;
      }
      const data: { url: string } = await resp.json();
      return { link: data.url };
    },
    isExpired: (ref, nowServer) => false,
  });
const compareRefs = (a: JourneyMinimalRef, b: JourneyMinimalRef): number => 0;
