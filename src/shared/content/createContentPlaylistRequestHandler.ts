import { convertUsingMapper } from '../../admin/crud/CrudFetcher';
import { HTTP_API_URL } from '../ApiConstants';
import { createGetDataFromRefUsingSignal } from '../images/createGetDataFromRefUsingSignal';
import { CancelablePromise } from '../lib/CancelablePromise';
import { getJwtExpiration } from '../lib/getJwtExpiration';
import { RequestHandler, Result } from '../requests/RequestHandler';
import { OsehContentRefLoadable } from './OsehContentRef';
import { OsehContentPlaylist, osehAPIContentPlaylistMapper } from './OsehContentTarget';

/**
 * Creates a request handler for fetching what media is available for
 * a given content ref.
 *
 * This is for the web only; for native apps, a content ref can be directly
 * converted to an m3u8 url which is generated on the fly given search parameters
 * via `getNativeExport`
 */
export const createContentPlaylistRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<OsehContentRefLoadable, OsehContentPlaylist> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: OsehContentRefLoadable): string => ref.uid;
const getDataFromRef: (
  ref: OsehContentRefLoadable
) => CancelablePromise<Result<OsehContentPlaylist>> = createGetDataFromRefUsingSignal({
  inner: async (ref, signal) => {
    const response = await fetch(
      `${HTTP_API_URL}/api/1/content_files/${ref.uid}/web.json?presign=0`,
      {
        method: 'GET',
        headers: {
          Authorization: `bearer ${ref.jwt}`,
        },
        signal,
      }
    );
    if (!response.ok) {
      throw response;
    }
    const raw = await response.json();
    const parsed = convertUsingMapper(raw, osehAPIContentPlaylistMapper);
    return { playlist: parsed, ref, presigned: false };
  },
  isExpired: (ref, nowServer) => getJwtExpiration(ref.jwt) < nowServer,
});
const compareRefs = (a: OsehContentRefLoadable, b: OsehContentRefLoadable): number =>
  getJwtExpiration(b.jwt) - getJwtExpiration(a.jwt);
