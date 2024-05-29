import { RequestHandler } from '../../../../../shared/requests/RequestHandler';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import { LoginContextValueLoggedIn } from '../../../../../shared/contexts/LoginContext';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { Emotion } from '../../../../../shared/models/Emotion';

/**
 * Creates a request handler for the emotions that the user can choose from
 */
export const createEmotionsRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<LoginContextValueLoggedIn, Emotion[]> => {
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
  inner: async (ref: LoginContextValueLoggedIn, signal): Promise<Emotion[]> => {
    const now = new Date();
    const resp = await apiFetch(
      '/api/1/emotions/personalized',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          num_emotions: 16,
          local_time: {
            hour_24: now.getHours(),
            minute: now.getMinutes(),
          },
        }),
        signal,
      },
      ref
    );
    if (!resp.ok) {
      throw resp;
    }
    const dataRaw: { items: Emotion[] } = await resp.json();
    return dataRaw.items;
  },
});

const compareRefs = (a: LoginContextValueLoggedIn, b: LoginContextValueLoggedIn): number =>
  getJwtExpiration(b.authTokens.idToken) - getJwtExpiration(a.authTokens.idToken);
