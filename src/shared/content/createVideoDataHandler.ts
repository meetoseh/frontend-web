import { createGetDataFromRefUsingSignal } from '../images/createGetDataFromRefUsingSignal';
import { CancelablePromise } from '../lib/CancelablePromise';
import { getJwtExpiration } from '../lib/getJwtExpiration';
import { RequestHandler, Result } from '../requests/RequestHandler';
import {
  ContentFileWebExport,
  ContentFileWebExportRef,
  OsehContentPlaylist,
  VideoFileData,
} from './OsehContentTarget';
import { createVideoSizeComparerForTarget } from './createVideoSizeComparerForTarget';
import { waitUntilMediaIsReady } from './useOsehVideoContentState';

/**
 * Manages downloading the video associated with the corresponding ref
 */
export const createVideoDataRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<ContentFileWebExportRef, ContentFileWebExportRef, VideoFileData> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: ContentFileWebExportRef): string =>
  ref.target.url + (ref.presigned ? '' : `?jwt=${ref.playlistRef.jwt}`);
const getDataFromRef: (ref: ContentFileWebExportRef) => CancelablePromise<Result<VideoFileData>> =
  createGetDataFromRefUsingSignal({
    inner: async (ref, signal) => {
      const video = initVideo({
        ref,
      });
      const videoSrc = video.element.src;
      const videoReadyCancelable = waitUntilMediaIsReady(video.element, videoSrc);
      signal.addEventListener('abort', () => {
        videoReadyCancelable.cancel();
      });
      if (signal.aborted) {
        videoReadyCancelable.cancel();
      }

      try {
        await videoReadyCancelable.promise;
      } catch (e) {
        video.element.src = '';
        video.element.load();
        throw e;
      }
      return {
        element: video.element,
        width: video.width ?? (video.element.videoWidth > 0 ? video.element.videoWidth : undefined),
        height:
          video.height ?? (video.element.videoHeight > 0 ? video.element.videoHeight : undefined),
      };
    },
    isExpired: (ref, nowServer) => getJwtExpiration(ref.playlistRef.jwt) < nowServer,
  });
const compareRefs = (a: ContentFileWebExportRef, b: ContentFileWebExportRef): number =>
  getJwtExpiration(b.playlistRef.jwt) - getJwtExpiration(a.playlistRef.jwt);

/**
 * The typical way to go from an OsehContentPlaylist to the appropriate input
 * for the video data handler request
 */
export const selectVideoTarget = ({
  playlist,
  size,
}: {
  playlist: OsehContentPlaylist;
  size: { width: number; height: number };
}): ContentFileWebExportRef => {
  const comparer = createVideoSizeComparerForTarget(size.width, size.height);
  let bestExport: ContentFileWebExport | null = null;
  for (const exportData of playlist.playlist.exports) {
    if (exportData.format !== 'mp4') {
      continue;
    }

    if (bestExport === null || comparer(bestExport, exportData) > 0) {
      bestExport = exportData;
    }
  }
  if (bestExport === null) {
    throw new Error('No mp4 exports found');
  }
  return {
    playlistRef: playlist.ref,
    target: bestExport,
    presigned: playlist.presigned,
  };
};

const initVideo = ({ ref }: { ref: ContentFileWebExportRef }): VideoFileData => {
  const video = document.createElement('video');
  video.setAttribute('preload', 'auto');

  const realWidthRaw = ref.target.formatParameters.width as unknown;
  const realWidth = typeof realWidthRaw === 'number' ? realWidthRaw : null;
  const realHeightRaw = ref.target.formatParameters.height as unknown;
  const realHeight = typeof realHeightRaw === 'number' ? realHeightRaw : null;

  if (realWidth !== null && realHeight !== null) {
    video.setAttribute('width', `${realWidth}`);
    video.setAttribute('height', `${realHeight}`);
  }

  const videoSrc =
    ref.target.url + (ref.presigned ? '' : '?jwt=' + encodeURIComponent(ref.playlistRef.jwt));
  video.setAttribute('src', videoSrc);
  return { element: video, width: realWidth ?? undefined, height: realHeight ?? undefined };
};
