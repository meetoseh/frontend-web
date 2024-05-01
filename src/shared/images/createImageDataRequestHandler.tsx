import { CancelablePromise } from '../lib/CancelablePromise';
import { getJwtExpiration } from '../lib/getJwtExpiration';
import { OsehImageExport } from './OsehImageExport';
import { OsehImageExportRef } from './OsehImageExportRef';
import { downloadItem } from './downloadItem';
import { RequestHandler, Result } from '../requests/RequestHandler';
import { createGetDataFromRefUsingSignal } from './createGetDataFromRefUsingSignal';

/**
 * Creates a request handler which accepts a ref to a specific image export and
 * converts it to the binary data for that image as a local blob, uncropped and
 * unscaled, maintaining the image export UID in the result (which permanently
 * and uniquely identifies the blobs contents, just as a sha512 would, but by
 * construction rather than computation)
 *
 * PERF:
 *   This _potentially_ does a lot of JWT decoding. If that becomes an issue,
 *   we'll need to have the JWT expiry included in the oseh image ref so we
 *   aren't constantly recomputing it.
 */
export const createImageDataRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<OsehImageExportRef, OsehImageExport> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: OsehImageExportRef): string => ref.item.uid;
const getDataFromRef: (ref: OsehImageExportRef) => CancelablePromise<Result<OsehImageExport>> =
  createGetDataFromRefUsingSignal({
    inner: async (ref, signal) => {
      const downloaded = await downloadItem(ref.item, ref.imageFile.jwt, { abortSignal: signal });
      return { imageFileUid: ref.item.uid, item: ref.item, localUrl: downloaded.localUrl };
    },
    isExpired: (ref, nowServer) => getJwtExpiration(ref.imageFile.jwt) < nowServer,
  });
const compareRefs = (a: OsehImageExportRef, b: OsehImageExportRef): number =>
  getJwtExpiration(b.imageFile.jwt) - getJwtExpiration(a.imageFile.jwt);
