import { LoginContextValueLoggedIn } from '../../../shared/contexts/LoginContext';
import { RequestHandler, RequestResult } from '../../../shared/requests/RequestHandler';
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
  const loginContextRaw = ctx.login.value.get();
  if (loginContextRaw.state !== 'logged-in') {
    throw new Error('createLoginContextRequest but not logged in');
  }
  const loginContext = loginContextRaw;
  return handler.request({
    ref: mapper(loginContext),
    refreshRef: () => {
      const latestLoginContext = ctx.login.value.get();
      if (latestLoginContext.state !== 'logged-in') {
        return {
          promise: Promise.resolve({
            type: 'error',
            data: undefined,
            error: <>Not logged in</>,
            retryAt: undefined,
          }),
          done: () => true,
          cancel: () => {},
        };
      }

      return {
        promise: Promise.resolve({
          type: 'success',
          data: mapper(latestLoginContext),
          error: undefined,
          retryAt: undefined,
        }),
        done: () => true,
        cancel: () => {},
      };
    },
  });
};
