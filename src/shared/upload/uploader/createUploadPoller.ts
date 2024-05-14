import {
  CrudFetcherFilter,
  CrudFetcherKeyMap,
  convertUsingKeymap,
} from '../../../admin/crud/CrudFetcher';
import { apiFetch } from '../../ApiConstants';
import { LoginContextValue } from '../../contexts/LoginContext';
import { CancelablePromise } from '../../lib/CancelablePromise';
import { constructCancelablePromise } from '../../lib/CancelablePromiseConstructor';

/**
 * Creates an upload poller, which can fetch the result of an upload
 * based on its sha512, if available, in a cancelable manner, from
 * a search endpoint and key map.
 *
 * @param path The path to the search endpoint, e.g., `/api/1/journeys/background_images/search`
 * @param keyMap The key map to use to convert the raw result to the desired type, or a function to do so
 * @param loginContext Authorization information; if not logged in, the promise will be rejected
 * @returns A function which can be called with a sha512 to fetch the result of the upload
 */
export const createUploadPoller = <T extends object>(
  path: string,
  keyMap: CrudFetcherKeyMap<T> | ((raw: any) => T),
  loginContextRaw: LoginContextValue,
  opts?: {
    /**
     * The key to filter on with the provided sha512, e.g., `original_file_sha512`,
     * or null to suppress filtering by sha512
     * @default 'original_file_sha512'
     */
    sha512Key?: string | ((sha512: string) => Record<string, CrudFetcherFilter>) | null;

    /**
     * Additional filters to apply to the search query. Applied after
     * the sha512 filter, if any.
     *
     * If not specified, treated as an empty object.
     */
    additionalFilters?: CrudFetcherFilter;

    /**
     * Additional client-side predicate for rejecting results.
     * If not specified, treated as always true.
     *
     * @param item The result from the server
     * @returns True if the item is acceptable, false if it should be rejected
     */
    predicate?: (item: T) => boolean;
  }
): ((sha512: string) => CancelablePromise<T | null>) => {
  const sha512Key = opts?.sha512Key === undefined ? 'original_file_sha512' : opts.sha512Key;

  const itemToApi =
    typeof keyMap === 'function' ? keyMap : (raw: any) => convertUsingKeymap(raw, keyMap);

  return (sha512: string) =>
    constructCancelablePromise({
      body: async (state, resolve, reject) => {
        const loginContextUnch = loginContextRaw.value.get();
        if (loginContextUnch.state !== 'logged-in') {
          state.finishing = true;
          state.done = true;
          reject(new Error('not logged in'));
          return;
        }
        const loginContext = loginContextUnch;

        const abortController: AbortController | null = window?.AbortController
          ? new AbortController()
          : null;
        const signal = abortController?.signal;
        const doAbort = () => abortController?.abort();
        state.cancelers.add(doAbort);

        if (state.finishing) {
          state.done = true;
          reject(new Error('canceled'));
          return;
        }

        const filters: Record<string, any> = {};
        if (sha512Key !== null) {
          if (typeof sha512Key === 'function') {
            Object.assign(filters, sha512Key(sha512));
          } else {
            filters[sha512Key] = {
              operator: 'eq',
              value: sha512,
            };
          }
        }
        if (opts?.additionalFilters !== undefined) {
          Object.assign(filters, opts.additionalFilters);
        }

        let response: Response;
        try {
          response = await apiFetch(
            path,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
              },
              body: JSON.stringify({
                filters,
                limit: 1,
              }),
              signal,
            },
            loginContext
          );
        } catch (e) {
          state.finishing = true;
          state.done = true;
          reject(new Error('failed to fetch', { cause: e }));
          return;
        }

        if (state.finishing) {
          state.done = true;
          reject(new Error('canceled'));
          return;
        }

        if (!response.ok) {
          state.finishing = true;
          state.done = true;
          reject(response);
          return;
        }

        let rawResult: { items: any[] };
        try {
          rawResult = await response.json();
        } catch (e) {
          state.finishing = true;
          state.done = true;
          reject(new Error('failed to download or parse response as json', { cause: e }));
          return;
        }

        if (state.finishing) {
          state.done = true;
          reject(new Error('canceled'));
          return;
        }

        if (rawResult.items.length === 0) {
          state.finishing = true;
          state.done = true;
          resolve(null);
          return;
        }

        let item: T;
        try {
          item = itemToApi(rawResult.items[0]);
        } catch (e) {
          state.finishing = true;
          state.done = true;
          reject(new Error(`failed to parse item from api`, { cause: e }));
          return;
        }

        if (opts?.predicate !== undefined && !opts.predicate(item)) {
          state.finishing = true;
          state.done = true;
          resolve(null);
          return;
        }

        state.finishing = true;
        state.done = true;
        resolve(item);
      },
    });
};
