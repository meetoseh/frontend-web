import { CancelablePromise } from '../lib/CancelablePromise';
import { getJwtExpiration } from '../lib/getJwtExpiration';
import { OsehImageRef } from './OsehImageRef';
import { PlaylistWithJWT, fetchPrivatePlaylist } from './Playlist';
import { RequestHandler, Result } from '../requests/RequestHandler';
import { createGetDataFromRefUsingSignal } from './createGetDataFromRefUsingSignal';

/**
 * Creates a playlist handler capable of converting a oseh image ref to
 * the corresponding playlist plus the list of exports available, forwarding
 * the JWT along (the uid is included in the returned playlist, so the entire
 * ref is recoverable)
 *
 * PERF:
 *   This _potentially_ does a lot of JWT decoding. If that becomes an issue,
 *   we'll need to have the JWT expiry included in the oseh image ref so we
 *   aren't constantly recomputing it.
 */
export const createImagePrivatePlaylistRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<OsehImageRef, PlaylistWithJWT> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: OsehImageRef): string => ref.uid;
const getDataFromRef: (ref: OsehImageRef) => CancelablePromise<Result<PlaylistWithJWT>> =
  createGetDataFromRefUsingSignal({
    inner: async (ref, signal) => {
      const unwrapped = await fetchPrivatePlaylist(ref.uid, ref.jwt, signal);
      return { playlist: unwrapped, jwt: ref.jwt };
    },
    isExpired: (ref, nowServer) => getJwtExpiration(ref.jwt) < nowServer,
  });
const compareRefs = (a: OsehImageRef, b: OsehImageRef): number =>
  getJwtExpiration(b.jwt) - getJwtExpiration(a.jwt);
