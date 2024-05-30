import { LoginContextValueLoggedIn } from '../../../shared/contexts/LoginContext';
import { RequestHandler, RequestResult } from '../../../shared/requests/RequestHandler';
import { ScreenContext } from '../hooks/useScreenContext';
import { createMappedLoginContextRequest } from './createMappedLoginContextRequest';

/**
 * Uses the standard technique to make a request that uses the logged in
 * user as the ref. Right now this is a bit of a special case as its expected
 * to update itself before it expires, so handling expiration is just grabbing
 * the latest value.
 */
export const createLoginContextRequest = <DataT extends object>({
  ctx,
  handler,
}: {
  ctx: ScreenContext;
  handler: RequestHandler<LoginContextValueLoggedIn, LoginContextValueLoggedIn, DataT>;
}): RequestResult<DataT> => {
  return createMappedLoginContextRequest({ ctx, handler, mapper: (r) => r });
};
