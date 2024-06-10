import { RequestHandler } from '../../../../../shared/requests/RequestHandler';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { LoginContextValueLoggedIn } from '../../../../../shared/contexts/LoginContext';
import {
  OnboardingVideo,
  onboardingVideoKeyMap,
} from '../../../../../shared/models/OnboardingVideo';
import { convertUsingMapper } from '../../../../../admin/crud/CrudFetcher';

/**
 * Creates a request handler for the appropriate onboarding welcome video
 * for the logged in user.
 */
export const createOnboardingVideoRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<LoginContextValueLoggedIn, LoginContextValueLoggedIn, OnboardingVideo> => {
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
  inner: async (ref: LoginContextValueLoggedIn, signal): Promise<OnboardingVideo> => {
    const resp = await apiFetch(
      '/api/1/onboarding/welcome-video',
      {
        method: 'GET',
        signal,
      },
      ref
    );
    if (!resp.ok) {
      throw resp;
    }
    const data = await resp.json();
    return convertUsingMapper(data, onboardingVideoKeyMap);
  },
});
const compareRefs = (a: LoginContextValueLoggedIn, b: LoginContextValueLoggedIn): number =>
  getJwtExpiration(b.authTokens.idToken) - getJwtExpiration(a.authTokens.idToken);
