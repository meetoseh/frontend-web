import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createDelayedValueWithCallbacks } from '../../../../shared/hooks/useDelayedValueWithCallbacks';
import { createMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { xAxisPhysicalPerLogical } from '../../../../shared/images/DisplayRatioHelper';
import { OsehImageExportCropped } from '../../../../shared/images/OsehImageExportCropped';
import { DisplaySize } from '../../../../shared/images/OsehImageProps';
import { OsehImageRef } from '../../../../shared/images/OsehImageRef';
import { getPlaylistImageExportRefUsingFixedSize } from '../../../../shared/images/getPlaylistImageExportUsingFixedSize';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../shared/lib/CancelablePromise';
import { mapCancelable } from '../../../../shared/lib/mapCancelable';
import { setVWC } from '../../../../shared/lib/setVWC';
import {
  RequestResult,
  RequestResultConcrete,
  Result,
} from '../../../../shared/requests/RequestHandler';
import { createChainedRequest } from '../../../../shared/requests/createChainedRequest';
import { OsehScreen } from '../../models/Screen';
import { convertScreenConfigurableTriggerWithOldVersion } from '../../models/ScreenConfigurableTrigger';
import { screenImageKeyMap } from '../../models/ScreenImage';
import { ImageInterstitial } from './ImageInterstitial';
import {
  ImageInterstitialAPIParams,
  ImageInterstitialMappedParams,
} from './ImageInterstitialParams';
import { ImageInterstitialResources } from './ImageInterstitialResources';

/**
 * An extremely basic screen with a header, message, and ok button.
 */
export const ImageInterstitialScreen: OsehScreen<
  'image_interstitial',
  ImageInterstitialResources,
  ImageInterstitialAPIParams,
  ImageInterstitialMappedParams
> = {
  slug: 'image_interstitial',
  paramMapper: (params) => ({
    top: params.top,
    image: convertUsingMapper(params.image, screenImageKeyMap),
    header: params.header,
    message: params.message,
    cta: params.cta,
    entrance: params.entrance,
    exit: params.exit,
    trigger: convertScreenConfigurableTriggerWithOldVersion(params.trigger, params.triggerv75),
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const activeVWC = createWritableValueWithCallbacks(true);

    const [imageSizeImmediateVWC, cleanupImageSizeImmediate] = createMappedValueWithCallbacks(
      ctx.contentWidth,
      (cw) => ({
        width: cw,
        height: Math.floor(cw * (215 / 342) * xAxisPhysicalPerLogical) / xAxisPhysicalPerLogical,
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
      getExportCropped()
    );

    const handleImageSizeChange = () => {
      const oldImg = imageVWC.get();
      if (oldImg !== null) {
        oldImg.release();
      }

      if (!activeVWC.get()) {
        setVWC(imageVWC, null);
        return;
      }

      setVWC(imageVWC, getExportCropped());
    };
    imageSizeDebouncedVWC.callbacks.add(handleImageSizeChange);

    const imageDataUnwrapperVWC = createWritableValueWithCallbacks<
      RequestResultConcrete<OsehImageExportCropped>
    >({
      type: 'loading',
      data: undefined,
      error: undefined,
    });

    const cleanupImageDataUnwrapper = (() => {
      let cancel: (() => void) | null = null;
      imageVWC.callbacks.add(attach);
      attach();
      return () => {
        imageVWC.callbacks.remove(attach);
        if (cancel !== null) {
          cancel();
          cancel = null;
        }
      };

      function attach() {
        if (cancel !== null) {
          cancel();
          cancel = null;
        }

        if (!activeVWC.get()) {
          return;
        }

        const imgRaw = imageVWC.get();
        if (imgRaw === null) {
          setVWC(imageDataUnwrapperVWC, {
            type: 'loading',
            data: undefined,
            error: undefined,
          });
          return;
        }
        const img = imgRaw;

        img.data.callbacks.add(onData);
        cancel = () => {
          img.data.callbacks.remove(onData);
        };
        onData();

        function onData() {
          if (!Object.is(imageVWC.get(), img)) {
            return;
          }

          const data = img.data.get();
          setVWC(imageDataUnwrapperVWC, data);
        }
      }
    })();

    return {
      ready: createWritableValueWithCallbacks(true),
      imageSizeImmediate: imageSizeImmediateVWC,
      image: imageDataUnwrapperVWC,
      dispose: () => {
        setVWC(activeVWC, false);
        cleanupImageSizeImmediate();
        cleanupImageSizeDebounced();
        cleanupImageDataUnwrapper();
        imageSizeDebouncedVWC.callbacks.remove(handleImageSizeChange);
        const img = imageVWC.get();
        if (img !== null) {
          img.release();
          setVWC(imageVWC, null);
        }
      },
    };
  },
  component: (props) => <ImageInterstitial {...props} />,
};
