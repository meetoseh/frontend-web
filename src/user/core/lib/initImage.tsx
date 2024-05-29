import { createMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { OsehImageExportCropped } from '../../../shared/images/OsehImageExportCropped';
import { OsehImageRef } from '../../../shared/images/OsehImageRef';
import {
  ValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { mapCancelable } from '../../../shared/lib/mapCancelable';
import { Result } from '../../../shared/requests/RequestHandler';
import { ScreenContext } from '../hooks/useScreenContext';
import { PeekedScreen } from '../models/Screen';
import { createChainedImageFromPlaylist } from './createChainedImageFromPlaylist';

/**
 * A convenience function for fetching the image and thumbhash from an image
 * ref provided directly via the screen parameters.
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

  const getPlaylist = () =>
    ctx.resources.privatePlaylistHandler.request({
      ref: { uid: ref.uid, jwt: ref.jwt },
      refreshRef,
    });

  return createChainedImageFromPlaylist({
    ctx,
    getPlaylist,
    sizeMapper,
  });
};
