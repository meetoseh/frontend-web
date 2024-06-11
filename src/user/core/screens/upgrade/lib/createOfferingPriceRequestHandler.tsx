import { convertUsingMapper } from '../../../../../admin/crud/CrudFetcher';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { LoginContextValueLoggedIn } from '../../../../../shared/contexts/LoginContext';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { CancelablePromise } from '../../../../../shared/lib/CancelablePromise';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import { RequestHandler, Result } from '../../../../../shared/requests/RequestHandler';
import {
  PurchasesStoreProduct,
  purchasesStoreProductKeyMap,
} from '../../../features/upgrade/models/PurchasesStoreProduct';

export type OfferingPriceRef = {
  user: LoginContextValueLoggedIn;
  platformProductIdentifier: string;
};

/**
 * Creates a request handler capable of fetching the price corresponding to
 * a particular product.
 */
export const createOfferingPriceRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<OfferingPriceRef, OfferingPriceRef, PurchasesStoreProduct> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: OfferingPriceRef): string =>
  ref.user.userAttributes.sub + '@' + ref.platformProductIdentifier;
const getDataFromRef: (ref: OfferingPriceRef) => CancelablePromise<Result<PurchasesStoreProduct>> =
  createGetDataFromRefUsingSignal({
    inner: async (ref, signal) => {
      const response = await apiFetch(
        `/api/1/users/me/stripe/products/${ref.platformProductIdentifier}/price`,
        { method: 'GET', signal },
        ref.user
      );
      if (!response.ok) {
        throw response;
      }
      const data = await response.json();
      return convertUsingMapper(data, purchasesStoreProductKeyMap);
    },
    isExpired: (ref, nowServer) => getJwtExpiration(ref.user.authTokens.idToken) < nowServer,
  });
const compareRefs = (a: OfferingPriceRef, b: OfferingPriceRef): number =>
  getJwtExpiration(b.user.authTokens.idToken) - getJwtExpiration(a.user.authTokens.idToken);
