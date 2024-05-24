import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { createValuesWithCallbacksEffect } from '../../../../shared/hooks/createValuesWithCallbacksEffect';
import { createDelayedValueWithCallbacks } from '../../../../shared/hooks/useDelayedValueWithCallbacks';
import { createMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { OsehImageExportCropped } from '../../../../shared/images/OsehImageExportCropped';
import { DisplaySize } from '../../../../shared/images/OsehImageProps';
import { OsehImageRef } from '../../../../shared/images/OsehImageRef';
import { getPlaylistImageExportRefUsingFixedSize } from '../../../../shared/images/getPlaylistImageExportUsingFixedSize';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../shared/lib/CancelablePromise';
import { mapCancelable } from '../../../../shared/lib/mapCancelable';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RequestResult, Result } from '../../../../shared/requests/RequestHandler';
import { createChainedRequest } from '../../../../shared/requests/createChainedRequest';
import { unwrapRequestResult } from '../../../../shared/requests/unwrapRequestResult';
import { PurchasesStoreProduct } from '../../features/upgrade/models/PurchasesStoreProduct';
import { RevenueCatOffering } from '../../features/upgrade/models/RevenueCatOffering';
import { OsehScreen } from '../../models/Screen';
import { screenImageKeyMap } from '../../models/ScreenImage';
import { Upgrade } from './Upgrade';
import { UpgradeAPIParams, UpgradeMappedParams } from './UpgradeParams';
import { UpgradeResources } from './UpgradeResources';

/**
 * Upgrade screen with back button and custom message. Skips immediately
 * on the component if the user already has oseh+
 */
export const UpgradeScreen: OsehScreen<
  'upgrade',
  UpgradeResources,
  UpgradeAPIParams,
  UpgradeMappedParams
> = {
  slug: 'upgrade',
  paramMapper: (params) => ({
    ...params,
    image: convertUsingMapper(params.image, screenImageKeyMap),
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const activeVWC = createWritableValueWithCallbacks(true);

    const [imageSizeImmediateVWC, cleanupImageSizeImmediate] = createMappedValueWithCallbacks(
      ctx.windowSizeImmediate,
      (size) => ({
        width: size.width,
        height: size.height - 410,
      })
    );
    const [imageSizeDebouncedVWC, cleanupImageSizeDebounced] = createDelayedValueWithCallbacks(
      imageSizeImmediateVWC,
      100
    );

    const getPlaylist = () =>
      ctx.resources.privatePlaylistHandler.request({
        ref: { uid: screen.parameters.image.uid, jwt: screen.parameters.image.jwt },
        refreshRef: (): CancelablePromise<Result<OsehImageRef>> => {
          if (!activeVWC.get()) {
            return {
              promise: Promise.resolve({
                type: 'expired',
                data: undefined,
                error: <>Screen is not mounted</>,
                retryAt: undefined,
              }),
              done: () => true,
              cancel: () => {},
            };
          }

          return mapCancelable(
            refreshScreen(),
            (s): Result<OsehImageRef> =>
              s.type !== 'success'
                ? s
                : {
                    type: 'success',
                    data: { uid: s.data.parameters.image.uid, jwt: s.data.parameters.image.jwt },
                    error: undefined,
                    retryAt: undefined,
                  }
          );
        },
      });

    const getExport = () =>
      createChainedRequest(getPlaylist, ctx.resources.imageDataHandler, {
        sync: (playlist) =>
          getPlaylistImageExportRefUsingFixedSize({
            size: {
              displayWidth: imageSizeImmediateVWC.get().width,
              displayHeight: imageSizeImmediateVWC.get().height,
            },
            playlist,
            usesWebp: ctx.usesWebp,
            usesSvg: ctx.usesSvg,
          }),
        async: undefined,
        cancelable: undefined,
      });

    const getExportCropped = () =>
      createChainedRequest(getExport, ctx.resources.imageCropHandler, {
        sync: (exp) => ({
          export: exp,
          cropTo: {
            displayWidth: imageSizeImmediateVWC.get().width,
            displayHeight: imageSizeImmediateVWC.get().height,
          } as DisplaySize,
        }),
        async: undefined,
        cancelable: undefined,
      });

    const imageVWC = createWritableValueWithCallbacks<RequestResult<OsehImageExportCropped> | null>(
      null
    );
    const cleanupImageRequester = createValueWithCallbacksEffect(
      imageSizeDebouncedVWC,
      () => {
        const req = getExportCropped();
        setVWC(imageVWC, req);
        return () => {
          req.release();
          if (Object.is(imageVWC.get(), req)) {
            setVWC(imageVWC, null);
          }
        };
      },
      {
        applyBeforeCancel: true,
      }
    );

    const [imageUnwrappedVWC, cleanupImageUnwrapper] = unwrapRequestResult(
      imageVWC,
      (d) => d.data,
      () => null
    );

    const offeringVWC = createWritableValueWithCallbacks<RequestResult<RevenueCatOffering> | null>(
      null
    );
    const cleanupOfferingRequester = createValueWithCallbacksEffect(
      ctx.login.value,
      (loginContextUnch) => {
        if (loginContextUnch.state !== 'logged-in') {
          setVWC(offeringVWC, null);
          return undefined;
        }
        const loginContext = loginContextUnch;
        const req = ctx.resources.offeringHandler.request({
          ref: loginContext,
          refreshRef: () => ({
            promise: Promise.reject(new Error('login refresh not supported here')),
            done: () => true,
            cancel: () => {},
          }),
        });
        setVWC(offeringVWC, req);
        return () => {
          req.release();
          if (Object.is(offeringVWC.get(), req)) {
            setVWC(offeringVWC, null);
          }
        };
      }
    );

    const [offeringUnwrappedVWC, cleanupOfferingUnwrapper] = unwrapRequestResult(
      offeringVWC,
      (d) => d.data,
      () => null
    );

    const shouldSkipVWC = createWritableValueWithCallbacks(false);
    const cleanupShouldSkipEffect = createValueWithCallbacksEffect(offeringVWC, (req) => {
      if (req === null) {
        setVWC(shouldSkipVWC, false);
        return undefined;
      }

      return createValueWithCallbacksEffect(req.data, (data) => {
        setVWC(shouldSkipVWC, data.type === 'error');
        return () => {
          setVWC(shouldSkipVWC, false);
        };
      });
    });

    const pricesVWC = createWritableValueWithCallbacks<
      Map<string, ValueWithCallbacks<RequestResult<PurchasesStoreProduct> | null>>
    >(new Map());
    const cleanupPricesEffect = createValuesWithCallbacksEffect(
      [offeringUnwrappedVWC, ctx.login.value],
      () => {
        const offer = offeringUnwrappedVWC.get();
        const loginContextUnch = ctx.login.value.get();
        if (offer === null || loginContextUnch.state !== 'logged-in') {
          setVWC(pricesVWC, new Map());
          return undefined;
        }

        const user = loginContextUnch;
        const newPrices = new Map<
          string,
          WritableValueWithCallbacks<RequestResult<PurchasesStoreProduct> | null>
        >();
        offer.packages.forEach((p) => {
          const req = ctx.resources.priceHandler.request({
            ref: {
              user,
              platformProductIdentifier: p.platformProductIdentifier,
            },
            refreshRef: () => ({
              promise: Promise.reject(new Error('login refresh not supported here')),
              done: () => true,
              cancel: () => {},
            }),
          });
          newPrices.set(
            p.platformProductIdentifier,
            createWritableValueWithCallbacks<RequestResult<PurchasesStoreProduct> | null>(req)
          );
        });
        setVWC(pricesVWC, newPrices);
        return () => {
          if (Object.is(pricesVWC.get(), newPrices)) {
            setVWC(pricesVWC, new Map());
          }
          newPrices.forEach((reqVWC) => {
            const req = reqVWC.get();
            if (req !== null) {
              req.release();
              setVWC(reqVWC, null);
            }
          });
        };
      }
    );

    const pricesUnwrappedVWC = createWritableValueWithCallbacks<
      Map<string, ValueWithCallbacks<PurchasesStoreProduct | null>>
    >(new Map());
    const cleanupPricesUnwrapperEffect = createValueWithCallbacksEffect(pricesVWC, (prices) => {
      const result = new Map<string, ValueWithCallbacks<PurchasesStoreProduct | null>>();
      const cleanup = Array.from(prices.entries()).map(([k, v]) => {
        const [vwc, cleanup] = unwrapRequestResult(
          v,
          (d) => d.data,
          () => null
        );
        result.set(k, vwc);
        return cleanup;
      });
      setVWC(pricesUnwrappedVWC, result);
      return () => cleanup.forEach((c) => c());
    });

    return {
      ready: createWritableValueWithCallbacks(true),
      imageSizeImmediate: imageSizeImmediateVWC,
      image: imageUnwrappedVWC,
      offering: offeringUnwrappedVWC,
      shouldSkip: shouldSkipVWC,
      prices: pricesUnwrappedVWC,
      dispose: () => {
        setVWC(activeVWC, false);
        cleanupImageSizeImmediate();
        cleanupImageSizeDebounced();
        cleanupImageRequester();
        cleanupImageUnwrapper();
        cleanupOfferingRequester();
        cleanupOfferingUnwrapper();
        cleanupShouldSkipEffect();
        cleanupPricesEffect();
        cleanupPricesUnwrapperEffect();
      },
    };
  },
  component: (props) => <Upgrade {...props} />,
};
