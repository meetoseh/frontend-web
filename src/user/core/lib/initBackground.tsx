import { createValueWithCallbacksEffect } from '../../../shared/hooks/createValueWithCallbacksEffect';
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
import { ScreenImageParsed } from '../models/ScreenImage';

/**
 * Manages downloading and unwrapping a background image. This is just a specific
 * case for `initImage` thats relatively common.
 */
export const initBackground = <
  SlugT extends string,
  ParamT extends { background: ScreenImageParsed | null }
>(
  ctx: ScreenContext,
  screen: PeekedScreen<SlugT, ParamT>,
  refreshScreen: () => CancelablePromise<Result<PeekedScreen<SlugT, ParamT>>>
): [ValueWithCallbacks<OsehImageExportCropped | null>, () => void] => {
  if (screen.parameters.background === null) {
    return [createWritableValueWithCallbacks(null), () => {}];
  }

  const activeVWC = createWritableValueWithCallbacks(true);
  const background = screen.parameters.background;

  const getPlaylist = () =>
    ctx.resources.privatePlaylistHandler.request({
      ref: { uid: background.uid, jwt: background.jwt },
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
              : s.data.parameters.background === null
              ? {
                  type: 'expired',
                  data: undefined,
                  error: <>Screen has no background anymore</>,
                  retryAt: undefined,
                }
              : {
                  type: 'success',
                  data: {
                    uid: s.data.parameters.background.uid,
                    jwt: s.data.parameters.background.jwt,
                  },
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
            displayWidth: ctx.windowSizeImmediate.get().width,
            displayHeight: ctx.windowSizeImmediate.get().height,
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
          displayWidth: ctx.windowSizeImmediate.get().width,
          displayHeight: ctx.windowSizeImmediate.get().height,
        } as DisplaySize,
      }),
      async: undefined,
      cancelable: undefined,
    });

  const imageVWC = createWritableValueWithCallbacks<RequestResult<OsehImageExportCropped> | null>(
    null
  );
  const cleanupImageRequester = createValueWithCallbacksEffect(
    ctx.windowSizeDebounced,
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

  return [
    imageUnwrappedVWC,
    () => {
      setVWC(activeVWC, false);
      cleanupImageRequester();
      cleanupImageUnwrapper();
    },
  ];
};
