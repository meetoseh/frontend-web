import { LoginContextValueLoggedIn } from '../../../shared/contexts/LoginContext';
import { createValueWithCallbacksEffect } from '../../../shared/hooks/createValueWithCallbacksEffect';
import { createWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { constructCancelablePromise } from '../../../shared/lib/CancelablePromiseConstructor';
import { DisplayableError } from '../../../shared/lib/errors';
import { setVWC } from '../../../shared/lib/setVWC';
import {
  RequestHandler,
  RequestResult,
  RequestResultConcrete,
} from '../../../shared/requests/RequestHandler';
import { ScreenContext } from '../hooks/useScreenContext';

/**
 * Uses the standard technique to make a request that uses the logged in user
 * (potentially mapped) as a ref. Right now this is a bit of a special case as
 * its expected to update itself before it expires, so handling expiration is
 * just grabbing the latest value.
 */
export const createMappedLoginContextRequest = <
  RefForUIDT extends object,
  RefT extends RefForUIDT,
  DataT extends object
>({
  ctx,
  handler,
  mapper,
}: {
  ctx: ScreenContext;
  handler: RequestHandler<RefForUIDT, RefT, DataT>;
  mapper: (user: LoginContextValueLoggedIn) => RefT;
}): RequestResult<DataT> => {
  const dataVWC = createWritableValueWithCallbacks<RequestResultConcrete<DataT>>({
    type: 'loading',
    data: undefined,
    error: undefined,
  });

  const cleanupRequester = createValueWithCallbacksEffect(ctx.login.value, (loginStateRaw) => {
    if (loginStateRaw.state === 'loading') {
      setVWC(dataVWC, { type: 'loading', data: undefined, error: undefined });
      return () => {};
    }

    if (loginStateRaw.state !== 'logged-in') {
      setVWC(dataVWC, {
        type: 'error',
        data: undefined,
        error: new DisplayableError('server-refresh-required', 'get user state', 'not logged in'),
      });
      return () => {};
    }

    const loginState = loginStateRaw;
    const req = handler.request({
      ref: mapper(loginState),
      refreshRef: () =>
        constructCancelablePromise({
          body: async (state, resolve, reject) => {
            if (state.finishing) {
              state.done = true;
              reject(new Error('canceled'));
              return;
            }

            const newState = ctx.login.value.get();
            if (Object.is(newState, loginState)) {
              state.finishing = true;
              state.done = true;
              resolve({
                type: 'error',
                data: undefined,
                error: new DisplayableError('server-refresh-required', 'get user state'),
                retryAt: undefined,
              });
              return;
            }

            if (newState.state !== 'logged-in') {
              state.finishing = true;
              state.done = true;
              resolve({
                type: 'error',
                data: undefined,
                error: new DisplayableError(
                  'server-refresh-required',
                  'get user based data',
                  'not logged in'
                ),
                retryAt: undefined,
              });
              return;
            }

            state.finishing = true;
            state.done = true;
            resolve({
              type: 'success',
              data: mapper(newState),
              error: undefined,
              retryAt: undefined,
            });
          },
        }),
    });

    const cleanupRequestMapper = createValueWithCallbacksEffect(req.data, (d) => {
      setVWC(dataVWC, d);
      return undefined;
    });

    return () => {
      cleanupRequestMapper();
      req.release();
    };
  });

  return {
    data: dataVWC,
    release: () => {
      cleanupRequester();
      setVWC(dataVWC, {
        type: 'released',
        data: undefined,
        error: undefined,
      });
    },
  };
};
