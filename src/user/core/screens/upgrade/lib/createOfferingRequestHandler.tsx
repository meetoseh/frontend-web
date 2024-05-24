import { convertUsingMapper } from '../../../../../admin/crud/CrudFetcher';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { LoginContextValueLoggedIn } from '../../../../../shared/contexts/LoginContext';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { CancelablePromise } from '../../../../../shared/lib/CancelablePromise';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import { RequestHandler, Result } from '../../../../../shared/requests/RequestHandler';
import { RevenueCatPlatform } from '../../../features/upgrade/lib/RevenueCatPlatform';
import { RevenueCatOffering } from '../../../features/upgrade/models/RevenueCatOffering';
import { revenueCatOfferingsKeyMap } from '../../../features/upgrade/models/RevenueCatOfferings';

/**
 * Creates a request handler capable of fetching the offering for the logged
 * in user.
 */
export const createOfferingRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<LoginContextValueLoggedIn, RevenueCatOffering> => {
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
const getDataFromRef: (
  ref: LoginContextValueLoggedIn
) => CancelablePromise<Result<RevenueCatOffering>> = createGetDataFromRefUsingSignal({
  inner: async (ref, signal) => {
    const response = await apiFetch(
      `/api/1/users/me/offerings?platform=${RevenueCatPlatform}`,
      {
        method: 'GET',
        signal,
      },
      ref
    );
    if (!response.ok) {
      throw response;
    }
    signal?.throwIfAborted();
    const data = await response.json();
    signal?.throwIfAborted();
    const offerings = convertUsingMapper(data, revenueCatOfferingsKeyMap);
    const current = offerings.offerings.find((o) => o.identifier === offerings.currentOfferingId);
    if (!current) {
      throw new Error('Current offering not found');
    }
    return current;
  },
  isExpired: (ref, nowServer) => getJwtExpiration(ref.authTokens.idToken) < nowServer,
});
const compareRefs = (a: LoginContextValueLoggedIn, b: LoginContextValueLoggedIn): number =>
  getJwtExpiration(b.authTokens.idToken) - getJwtExpiration(a.authTokens.idToken);
