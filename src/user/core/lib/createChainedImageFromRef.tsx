import { OsehImageExportCropped } from '../../../shared/images/OsehImageExportCropped';
import { OsehImageRef } from '../../../shared/images/OsehImageRef';
import { ValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { RequestResult } from '../../../shared/requests/RequestHandler';
import { createChainedRequest } from '../../../shared/requests/createChainedRequest';
import { ScreenContext } from '../hooks/useScreenContext';
import { createChainedImageFromPlaylist } from './createChainedImageFromPlaylist';

/**
 * Extracts the cropped image from a function which gets a ref to the image.
 */
export const createChainedImageFromRef = ({
  ctx,
  getRef,
  sizeMapper,
}: {
  ctx: ScreenContext;
  getRef: () => RequestResult<OsehImageRef>;
  sizeMapper: (windowSize: { width: number; height: number }) => { width: number; height: number };
}): {
  image: ValueWithCallbacks<OsehImageExportCropped | null>;
  thumbhash: ValueWithCallbacks<string | null>;
  sizeImmediate: ValueWithCallbacks<{ width: number; height: number }>;
  dispose: () => void;
} => {
  const getPlaylist = () =>
    createChainedRequest(getRef, ctx.resources.privatePlaylistHandler, {
      sync: (r) => r,
      async: undefined,
      cancelable: undefined,
    });

  return createChainedImageFromPlaylist({
    ctx,
    getPlaylist,
    sizeMapper,
  });
};
