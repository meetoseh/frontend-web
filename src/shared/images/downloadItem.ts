import { DownloadedItem } from './DownloadedItem';
import { PlaylistItem } from './Playlist';
import { cropImage } from './cropImage';

/**
 * Downloads the given playlist item. Returns a rejected promise if
 * there is a network error or the server returns a non-200 status code.
 *
 * @param item The item to download
 * @param jwt The JWT to use to authenticate the request
 * @param opts.cropTo If specified, the downloaded image will be cropped to the given size.
 *   This is useful for when we are intentionally rendering an image at a lowered pixel ratio,
 *   as by default most browsers will instead stretch the image (which looks terrible).
 * @returns The downloaded item
 */
export const downloadItem = async (
  item: PlaylistItem,
  jwt: string,
  opts?: { cropTo?: { width: number; height: number }; abortSignal?: AbortSignal }
): Promise<DownloadedItem> => {
  const response = await fetch(item.url, {
    headers: { Authorization: `bearer ${jwt}` },
    ...(opts?.abortSignal === undefined ? {} : { signal: opts.abortSignal }),
  });
  if (!response.ok) {
    throw response;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  if (opts !== undefined && opts.cropTo !== undefined) {
    const cropped = await cropImage(url, opts.cropTo);
    return {
      remoteUrl: item.url,
      localUrl: cropped,
      originalLocalUrl: url,
      croppedTo: opts.cropTo,
    };
  }

  return {
    remoteUrl: item.url,
    localUrl: url,
    originalLocalUrl: url,
  };
};
