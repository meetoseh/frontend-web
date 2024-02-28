import { ReactElement, useCallback, useContext } from 'react';
import { UseRevenueCatOfferingsResult } from './useRevenueCatOfferings';
import {
  PurchasesStoreProduct,
  purchasesStoreProductKeyMap,
} from '../models/PurchasesStoreProduct';
import {
  Callbacks,
  ValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { LoginContext } from '../../../../../shared/contexts/LoginContext';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { describeError } from '../../../../../shared/forms/ErrorBlock';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { convertUsingMapper } from '../../../../../admin/crud/CrudFetcher';
import { useValuesWithCallbacksEffect } from '../../../../../shared/hooks/useValuesWithCallbacksEffect';

export type UseOfferingPriceProps = {
  /** The offerings whose price should be fetched */
  offering: ValueWithCallbacks<UseRevenueCatOfferingsResult>;
};

export type UseOfferingPriceResultLoading = {
  type: 'loading';
  pricesByPlatformProductId: null;
  error: null;
};

export type UseOfferingPriceResultError = {
  type: 'error';
  pricesByPlatformProductId: null;
  error: ReactElement;
};

export type UseOfferingPriceResultSuccess = {
  type: 'success';
  pricesByPlatformProductId: Record<string, PurchasesStoreProduct>;
};

export type UseOfferingPriceResult =
  | UseOfferingPriceResultLoading
  | UseOfferingPriceResultError
  | UseOfferingPriceResultSuccess;

export const useOfferingPrice = ({
  offering: offeringVWC,
}: UseOfferingPriceProps): ValueWithCallbacks<UseOfferingPriceResult> => {
  const loginContextRaw = useContext(LoginContext);
  const result = useWritableValueWithCallbacks<UseOfferingPriceResult>(() => createLoading());

  useValuesWithCallbacksEffect(
    [offeringVWC, loginContextRaw.value],
    useCallback(() => {
      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        setVWC(result, createLoading(), (a, b) => a.type === b.type);
        return;
      }
      const loginContext = loginContextUnch;

      const offeringUnch = offeringVWC.get();
      if (offeringUnch.type !== 'success') {
        setVWC(result, createLoading(), (a, b) => a.type === b.type);
        return;
      }
      const offering = offeringUnch.offering;

      const cancelers = new Callbacks<undefined>();
      let active = true;
      fetchPrices();
      return () => {
        active = false;
        cancelers.call(undefined);
      };

      async function fetchPricesInner(signal: AbortSignal | undefined) {
        signal?.throwIfAborted();
        if (offering.packages.length === 0) {
          setVWC(result, createSuccess({}));
          return;
        }

        const pricesArr = await Promise.all(
          offering.packages.map(async (p): Promise<[string, PurchasesStoreProduct]> => {
            const response = await apiFetch(
              `/api/1/users/me/stripe/products/${p.platformProductIdentifier}/price`,
              { method: 'GET', signal },
              loginContext
            );
            if (!response.ok) {
              throw response;
            }
            const data = await response.json();
            return [
              p.platformProductIdentifier,
              convertUsingMapper(data, purchasesStoreProductKeyMap),
            ];
          })
        );

        const pricesByPlatformProductId = Object.fromEntries(pricesArr);
        if (active) {
          setVWC(result, createSuccess(pricesByPlatformProductId));
        }
      }

      async function fetchPrices() {
        const controller = window.AbortController ? new window.AbortController() : undefined;
        const signal = controller?.signal;
        const doAbort = () => controller?.abort();
        cancelers.add(doAbort);
        if (!active) {
          cancelers.remove(doAbort);
          return;
        }

        setVWC(result, createLoading(), (a, b) => a.type === b.type);
        if (!active) {
          cancelers.remove(doAbort);
          return;
        }

        try {
          await fetchPricesInner(signal);
        } catch (e) {
          if (!active) {
            return;
          }
          const err = await describeError(e);
          if (!active) {
            return;
          }
          setVWC(result, createError(err));
        } finally {
          cancelers.remove(doAbort);
        }
      }
    }, [offeringVWC, loginContextRaw.value, result])
  );

  return result;
};

const createLoading = (): UseOfferingPriceResultLoading => ({
  type: 'loading',
  pricesByPlatformProductId: null,
  error: null,
});

const createError = (error: ReactElement): UseOfferingPriceResultError => ({
  type: 'error',
  pricesByPlatformProductId: null,
  error,
});

const createSuccess = (
  pricesByPlatformProductId: Record<string, PurchasesStoreProduct>
): UseOfferingPriceResultSuccess => ({
  type: 'success',
  pricesByPlatformProductId,
});
