import { createValueWithCallbacksEffect } from '../../../shared/hooks/createValueWithCallbacksEffect';
import { createMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { OsehImageExportCropped } from '../../../shared/images/OsehImageExportCropped';
import { DisplaySize } from '../../../shared/images/OsehImageProps';
import { PlaylistWithJWT } from '../../../shared/images/Playlist';
import { getPlaylistImageExportRefUsingFixedSize } from '../../../shared/images/getPlaylistImageExportUsingFixedSize';
import {
  ValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { setVWC } from '../../../shared/lib/setVWC';
import { RequestResult } from '../../../shared/requests/RequestHandler';
import { createChainedRequest } from '../../../shared/requests/createChainedRequest';
import { unwrapRequestResult } from '../../../shared/requests/unwrapRequestResult';
import { ScreenContext } from '../hooks/useScreenContext';

/**
 * Extracts the cropped image from a function which gets a request to the image
 * playlist.
 */
export const createChainedImageFromPlaylist = ({
  ctx,
  getPlaylist,
  sizeMapper,
}: {
  ctx: ScreenContext;
  getPlaylist: () => RequestResult<PlaylistWithJWT>;
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
  const [sizeDebounced, cleanupSizeDebounced] = createMappedValueWithCallbacks(
    ctx.windowSizeDebounced,
    sizeMapper,
    {
      inputEqualityFn: () => false,
      outputEqualityFn: (a, b) => a.width === b.width && a.height === b.height,
    }
  );

  const activeVWC = createWritableValueWithCallbacks(true);

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
