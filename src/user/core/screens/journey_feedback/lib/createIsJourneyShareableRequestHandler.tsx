import { apiFetch } from '../../../../../shared/ApiConstants';
import { LoginContextValue } from '../../../../../shared/contexts/LoginContext';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { RequestHandler } from '../../../../../shared/requests/RequestHandler';
import { JourneyMinimalRef } from './JourneyMinimalRef';

export type JourneyShareableInfo = { shareable: boolean };

/**
 * Creates a request handler capable of determining if journeys can be shared
 */
export const createIsJourneyShareableRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
  loginContextRaw,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
  loginContextRaw: LoginContextValue;
}): RequestHandler<JourneyMinimalRef, JourneyShareableInfo> => {
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
    inner: async (ref: JourneyMinimalRef, signal): Promise<JourneyShareableInfo> => {
      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        throw new Error('not logged in');
      }

      const loginContext = loginContextUnch;
      const resp = await apiFetch(
        '/api/1/journeys/check_if_shareable',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            uid: ref.uid,
          }),
          signal,
        },
        loginContext
      );
      if (!resp.ok) {
        if (resp.status === 404) {
          return { shareable: false };
        }
        throw resp;
      }
      const data: { shareable: boolean } = await resp.json();
      return data;
    },
    isExpired: (ref, nowServer) => false,
  });
const compareRefs = (a: JourneyMinimalRef, b: JourneyMinimalRef): number => 0;
