import { createWritableValueWithCallbacks } from '../lib/Callbacks';
import { CancelablePromise } from '../lib/CancelablePromise';
import { constructCancelablePromise } from '../lib/CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from '../lib/createCancelablePromiseFromCallbacks';
import { setVWC } from '../lib/setVWC';
import { RequestHandler, RequestResult } from './RequestHandler';

/**
 * Produces a new request, where the reference for this request is a mapped
 * version of the data from the previous request.
 *
 * @param createPrevious A function which can be called to initialize a new request
 *   for the previous data. We will release the previous request when its no
 *   longer needed for this request.
 * @param handler The request handler for producing _new_ requests
 * @param mapper A function which maps the previous data to the reference for
 *   the new request.
 */
export const createChainedRequest = <
  PrevDataT extends object,
  RefT extends object,
  DataT extends object
>(
  createPrevious: () => RequestResult<PrevDataT>,
  handler: RequestHandler<RefT, DataT>,
  mapper:
    | {
        sync: (prevData: PrevDataT) => RefT;
        async: undefined;
        cancelable: undefined;
      }
    | {
        sync: undefined;
        async: (prevData: PrevDataT) => Promise<RefT>;
        cancelable: undefined;
      }
    | {
        sync: undefined;
        async: undefined;
        cancelable: (prevData: PrevDataT) => CancelablePromise<RefT>;
      },
  opts?: {
    onRefChanged?: (newRef: RefT | null) => void;
  }
): RequestResult<DataT> => {
  const releasedVWC = createWritableValueWithCallbacks(false);
  let previous: RequestResult<PrevDataT> | null = null as RequestResult<PrevDataT> | null;

  const onRefChanged = opts?.onRefChanged ?? (() => {});
  onRefChanged(null);

  const rawResult = handler.request({
    ref: null,
    refreshRef: () => {
      return constructCancelablePromise({
        body: async (state, resolve, reject) => {
          const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
          canceled.promise.catch(() => {});
          if (state.finishing) {
            canceled.cancel();
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          const released = createCancelablePromiseFromCallbacks(releasedVWC.callbacks);
          released.promise.catch(() => {});
          if (releasedVWC.get()) {
            canceled.cancel();
            released.cancel();
            state.finishing = true;
            state.done = true;
            resolve({
              type: 'expired',
              data: undefined,
              error: <>This reference has been released</>,
              retryAt: undefined,
            });
            return;
          }

          let shouldRefresh = true;
          if (previous === null) {
            previous = createPrevious();
            shouldRefresh = false;
          }

          while (true) {
            const prev = previous;

            if (releasedVWC.get()) {
              canceled.cancel();
              released.cancel();
              if (previous !== null) {
                previous.release();
                previous = null;
              }
              state.finishing = true;
              state.done = true;
              resolve({
                type: 'expired',
                data: undefined,
                error: <>This reference has been released</>,
                retryAt: undefined,
              });
              return;
            }

            if (state.finishing) {
              canceled.cancel();
              released.cancel();
              state.done = true;
              reject(new Error('canceled'));
              return;
            }

            if (prev === null) {
              throw new Error('impossible state');
            }

            const changed = createCancelablePromiseFromCallbacks(prev.data.callbacks);
            changed.promise.catch(() => {});

            const data = prev.data.get();
            if (data.type === 'loading') {
              shouldRefresh = false;
              await Promise.race([changed.promise, canceled.promise, released.promise]);
              changed.cancel();
              continue;
            } else if (data.type === 'released') {
              if (releasedVWC.get() || state.finishing) {
                changed.cancel();
                continue;
              }
              throw new Error('impossible: previous should not be released from underneath us');
            } else if (data.type === 'error') {
              changed.cancel();

              if (shouldRefresh) {
                shouldRefresh = false;
                if (!Object.is(previous, prev)) {
                  throw new Error('sanity check failed: previous !== prev');
                }
                previous.release();
                previous = createPrevious();
                continue;
              }

              state.finishing = true;
              state.done = true;
              resolve({
                type: 'error',
                data: undefined,
                error: data.error,
                retryAt: undefined,
              });
              return;
            } else if (data.type === 'success') {
              if (shouldRefresh) {
                shouldRefresh = false;
                onRefChanged(null);
                data.reportExpired();
                await Promise.race([changed.promise, canceled.promise, released.promise]);
                changed.cancel();
                continue;
              }

              if (mapper.sync !== undefined) {
                changed.cancel();
                const mapped = mapper.sync(data.data);
                onRefChanged(mapped);
                state.finishing = true;
                state.done = true;
                resolve({
                  type: 'success',
                  data: mapped,
                  error: undefined,
                  retryAt: undefined,
                });
                return;
              }

              if (mapper.async !== undefined) {
                const mapped = await mapper.async(data.data);
                if (releasedVWC.get() || state.finishing || changed.done()) {
                  continue;
                }

                onRefChanged(mapped);
                state.finishing = true;
                state.done = true;
                resolve({
                  type: 'success',
                  data: mapped,
                  error: undefined,
                  retryAt: undefined,
                });
                return;
              }

              const mappedCancelable = mapper.cancelable(data.data);
              await Promise.race([
                changed.promise,
                canceled.promise,
                released.promise,
                mappedCancelable.promise,
              ]);
              if (!mappedCancelable.done()) {
                mappedCancelable.cancel();
                changed.cancel();
                continue;
              }
              const mappedData = await mappedCancelable.promise;
              if (releasedVWC.get() || state.finishing || changed.done()) {
                changed.cancel();
                continue;
              }

              changed.cancel();

              onRefChanged(mappedData);
              state.finishing = true;
              state.done = true;
              resolve({
                type: 'success',
                data: mappedData,
                error: undefined,
                retryAt: undefined,
              });
            } else {
              ((d: never) => {
                throw new Error(`unknown data: ${d}`);
              })(data);
            }
          }
        },
      });
    },
  });

  return {
    data: rawResult.data,
    release: () => {
      setVWC(releasedVWC, true);

      rawResult.release();

      if (previous !== null) {
        previous.release();
        previous = null;
        onRefChanged(null);
      }
    },
  };
};
