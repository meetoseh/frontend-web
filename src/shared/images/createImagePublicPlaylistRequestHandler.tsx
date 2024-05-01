import { CancelablePromise } from '../lib/CancelablePromise';
import { OsehPublicImageRef } from './OsehPublicImageRef';
import { PlaylistWithJWT, fetchPublicPlaylist } from './Playlist';
import { RequestHandler, Result } from '../requests/RequestHandler';
import { createGetDataFromRefUsingSignal } from './createGetDataFromRefUsingSignal';

/**
 * Creates a playlist handler capable of converting a public oseh image to
 * a temporary JWT for accessing that images exports, plus the list of exports
 * available
 */
export const createImagePublicPlaylistRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<OsehPublicImageRef, PlaylistWithJWT> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: OsehPublicImageRef): string => ref.uid;
const getDataFromRef: (ref: OsehPublicImageRef) => CancelablePromise<Result<PlaylistWithJWT>> =
  createGetDataFromRefUsingSignal({
    inner: (ref, signal) => fetchPublicPlaylist(ref.uid, signal),
  });
const compareRefs = (a: OsehPublicImageRef, b: OsehPublicImageRef): number => 0;
