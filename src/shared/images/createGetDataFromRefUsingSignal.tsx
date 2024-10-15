import { CancelablePromise } from '../lib/CancelablePromise';
import { constructCancelablePromise } from '../lib/CancelablePromiseConstructor';
import { DisplayableError } from '../lib/errors';
import { getCurrentServerTimeMS } from '../lib/getCurrentServerTimeMS';
import { Result } from '../requests/RequestHandler';

/**
 * Creates a getDataFromRef function for a RequestHandler where the inner-most
 * action is to perform a fetch with an abort signal.
 *
 * This will handle error management, using Retry-After headers or TypeError for
 * retryable errors.
 */
export const createGetDataFromRefUsingSignal =
  <RefT extends object, DataT extends object>({
    inner,
    isExpired,
  }: {
    inner: (ref: RefT, signal: AbortSignal) => Promise<DataT>;
    isExpired?: (ref: RefT, nowServer: number) => boolean;
  }) =>
  (ref: RefT): CancelablePromise<Result<DataT>> =>
    constructCancelablePromise({
      body: async (state, resolve, reject) => {
        const controller = new AbortController();
        const signal = controller.signal;
        const doAbort = () => controller.abort();
        state.cancelers.add(doAbort);
        if (state.finishing) {
          state.cancelers.remove(doAbort);
          state.done = true;
          reject(new Error('canceled'));
          return;
        }

        if (isExpired !== undefined) {
          const nowServer = await getCurrentServerTimeMS();
          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }
          if (isExpired(ref, nowServer)) {
            state.finishing = true;
            state.done = true;
            resolve({
              type: 'expired',
              data: undefined,
              error: new DisplayableError('server-refresh-required', 'fetch'),
              retryAt: undefined,
            });
            return;
          }
        }

        try {
          const result = await inner(ref, signal);
          state.finishing = true;
          state.done = true;
          resolve({
            type: 'success',
            data: result,
            error: undefined,
            retryAt: undefined,
          });
        } catch (e) {
          const described =
            e instanceof DisplayableError ? e : new DisplayableError('client', 'fetch', `${e}`);
          if (state.finishing) {
            state.done = true;
            reject(new DisplayableError('canceled', 'fetch'));
            return;
          }
          if (described.type === 'server-retryable') {
            resolve({
              type: 'errorRetryable',
              data: undefined,
              error: described,
              retryAt: new Date(Date.now() + 5000 + Math.random() * 1000),
            });
            return;
          }

          state.finishing = true;
          state.done = true;
          resolve({
            type: 'error',
            data: undefined,
            error: described,
            retryAt: undefined,
          });
        }
      },
    });
