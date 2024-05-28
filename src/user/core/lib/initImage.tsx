import { createValueWithCallbacksEffect } from '../../../shared/hooks/createValueWithCallbacksEffect';
import { createMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { OsehImageExportCropped } from '../../../shared/images/OsehImageExportCropped';
import { DisplaySize } from '../../../shared/images/OsehImageProps';
import { OsehImageRef } from '../../../shared/images/OsehImageRef';
import { getPlaylistImageExportRefUsingFixedSize } from '../../../shared/images/getPlaylistImageExportUsingFixedSize';
import {
  ValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { mapCancelable } from '../../../shared/lib/mapCancelable';
import { setVWC } from '../../../shared/lib/setVWC';
import { RequestResult, Result } from '../../../shared/requests/RequestHandler';
import { createChainedRequest } from '../../../shared/requests/createChainedRequest';
import { unwrapRequestResult } from '../../../shared/requests/unwrapRequestResult';
import { ScreenContext } from '../hooks/useScreenContext';
import { PeekedScreen } from '../models/Screen';

/**
 * A convenience function for fetching the image and thumbhash from an image
 * ref. Note that the thumbhash part can be discarded if a thumbhash was provided
 * in the screen parameters since wwe wouldn't want to flash the first thumbhash,
 * then a "better" thumbhash, then the image (we'd prefer to hold the first thumbhash)
 */
export const initImage = <SlugT extends string, ParamT extends { __mapped: boolean }>({
  ctx,
  screen,
  refreshScreen,
  paramMapper,
  sizeMapper,
}: {
  ctx: ScreenContext;
  screen: PeekedScreen<SlugT, ParamT>;
  refreshScreen: () => CancelablePromise<Result<PeekedScreen<SlugT, ParamT>>>;
  paramMapper: (params: ParamT) => OsehImageRef | null;
  sizeMapper: (windowSize: { width: number; height: number }) => { width: number; height: number };
}): {
  image: ValueWithCallbacks<OsehImageExportCropped | null>;
  thumbhash: ValueWithCallbacks<string | null>;
  sizeImmediate: ValueWithCallbacks<{ width: number; height: number }>;
  dispose: () => void;
} => {
  const [sizeImmediate, cleanupSizeImmediate] = createMappedValueWithCallbacks(
    ctx.windowSizeImmediate,
    sizeMapper,
    {
      inputEqualityFn: () => false,
      outputEqualityFn: (a, b) => a.width === b.width && a.height === b.height,
    }
  );

  const refRaw = paramMapper(screen.parameters);
  if (refRaw === null) {
    return {
      image: createWritableValueWithCallbacks<OsehImageExportCropped | null>(null),
      thumbhash: createWritableValueWithCallbacks<string | null>(null),
      sizeImmediate,
      dispose: () => {
        cleanupSizeImmediate();
      },
    };
  }

  let ref = refRaw;
  const refreshRef = (): CancelablePromise<Result<OsehImageRef>> =>
    mapCancelable(refreshScreen(), (s): Result<OsehImageRef> => {
      if (s.type !== 'success') {
        return s;
      }

      const refRaw = paramMapper(s.data.parameters);
      if (refRaw === null) {
        return {
          type: 'expired',
          data: undefined,
          error: <>This screen no longer needs this image</>,
          retryAt: undefined,
        };
      }
      ref = refRaw;

      return {
        type: 'success',
        data: refRaw,
        error: undefined,
        retryAt: undefined,
      };
    });

  const activeVWC = createWritableValueWithCallbacks(true);

  const [sizeDebounced, cleanupSizeDebounced] = createMappedValueWithCallbacks(
    ctx.windowSizeDebounced,
    sizeMapper,
    {
      inputEqualityFn: () => false,
      outputEqualityFn: (a, b) => a.width === b.width && a.height === b.height,
    }
  );

  const getPlaylist = () =>
    ctx.resources.privatePlaylistHandler.request({
      ref: { uid: ref.uid, jwt: ref.jwt },
      refreshRef,
    });

  const thumbhashVWC = createWritableValueWithCallbacks<string | null>(null);
  const getExport = () =>
    createChainedRequest(
      getPlaylist,
      ctx.resources.imageDataHandler,
      {
        sync: (playlist) =>
          getPlaylistImageExportRefUsingFixedSize({
            size: {
              displayWidth: sizeImmediate.get().width,
              displayHeight: sizeImmediate.get().height,
            },
            playlist,
            usesWebp: ctx.usesWebp,
            usesSvg: ctx.usesSvg,
          }),
        async: undefined,
        cancelable: undefined,
      },
      {
        onRefChanged: (newRef) => {
          if (activeVWC.get() && newRef !== null) {
            setVWC(thumbhashVWC, newRef.item.thumbhash);
          }
        },
      }
    );

  const getExportCropped = () =>
    createChainedRequest(getExport, ctx.resources.imageCropHandler, {
      sync: (exp) => ({
        export: exp,
        cropTo: {
          displayWidth: sizeImmediate.get().width,
          displayHeight: sizeImmediate.get().height,
        } as DisplaySize,
      }),
      async: undefined,
      cancelable: undefined,
    });

  const imageVWC = createWritableValueWithCallbacks<RequestResult<OsehImageExportCropped> | null>(
    null
  );
  const cleanupImageRequester = createValueWithCallbacksEffect(
    sizeDebounced,
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

  return {
    image: imageUnwrappedVWC,
    thumbhash: thumbhashVWC,
    sizeImmediate,
    dispose: () => {
      setVWC(activeVWC, false);
      cleanupSizeImmediate();
      cleanupSizeDebounced();
      cleanupImageRequester();
      cleanupImageUnwrapper();
    },
  };
};
