import { createGetDataFromRefUsingSignal } from '../images/createGetDataFromRefUsingSignal';
import { CancelablePromise } from '../lib/CancelablePromise';
import { getJwtExpiration } from '../lib/getJwtExpiration';
import { RequestHandler, Result } from '../requests/RequestHandler';
import {
  AudioFileData,
  ContentFileWebExport,
  ContentFileWebExportRef,
  OsehContentPlaylist,
} from './OsehContentTarget';
import { waitUntilMediaIsReady } from './useOsehVideoContentState';

/**
 * Manages downloading the audio associated with the corresponding ref
 */
export const createAudioDataRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<ContentFileWebExportRef, ContentFileWebExportRef, AudioFileData> => {
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
const getDataFromRef: (ref: ContentFileWebExportRef) => CancelablePromise<Result<AudioFileData>> =
  createGetDataFromRefUsingSignal({
    inner: async (ref, signal) => {
      const audio = initAudio({
        ref,
      });
      const audioSrc = audio.element.src;
      const readyCancelable = waitUntilMediaIsReady(audio.element, audioSrc);
      signal.addEventListener('abort', () => {
        readyCancelable.cancel();
      });
      if (signal.aborted) {
        readyCancelable.cancel();
      }

      try {
        await readyCancelable.promise;
      } catch (e) {
        audio.element.src = '';
        audio.element.load();
        throw e;
      }
      return {
        element: audio.element,
      };
    },
    isExpired: (ref, nowServer) => getJwtExpiration(ref.playlistRef.jwt) < nowServer,
  });
const compareRefs = (a: ContentFileWebExportRef, b: ContentFileWebExportRef): number =>
  getJwtExpiration(b.playlistRef.jwt) - getJwtExpiration(a.playlistRef.jwt);

/**
 * The typical way to go from an OsehContentPlaylist to the appropriate input
 * for the audio data handler request
 */
export const selectAudioTarget = ({
  playlist,
}: {
  playlist: OsehContentPlaylist;
}): ContentFileWebExportRef => {
  const comparer = (a: ContentFileWebExport, b: ContentFileWebExport): number =>
    b.bandwidth - a.bandwidth;

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

const initAudio = ({ ref }: { ref: ContentFileWebExportRef }): AudioFileData => {
  const audio = document.createElement('audio');
  audio.setAttribute('preload', 'auto');

  const audioSrc =
    ref.target.url + (ref.presigned ? '' : '?jwt=' + encodeURIComponent(ref.playlistRef.jwt));
  audio.setAttribute('src', audioSrc);
  return { element: audio };
};
