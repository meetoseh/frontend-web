import { RequestHandler } from '../../../../../shared/requests/RequestHandler';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { LoginContextValueLoggedIn } from '../../../../../shared/contexts/LoginContext';
import { CrudFetcherMapper, convertUsingMapper } from '../../../../../admin/crud/CrudFetcher';
import { Channel } from './Channel';

/** Internal representation about what channels are available for a user */
export type ReminderChannelsInfo = {
  /** The channels the user has not configured yet */
  unconfiguredChannels: Set<Channel>;

  /** The channels the user can configure meaningfully */
  potentialChannels: Set<Channel>;
};

export const reminderChannelsInfoKeyMap: CrudFetcherMapper<ReminderChannelsInfo> = (raw) => ({
  unconfiguredChannels: new Set(raw.channels),
  potentialChannels: new Set(raw.potential_channels),
});

/**
 * Creates a request handler for what reminder channels can be configured
 * and which ones haven't been configured ever.
 */
export const createReminderChannelsRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<LoginContextValueLoggedIn, LoginContextValueLoggedIn, ReminderChannelsInfo> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: LoginContextValueLoggedIn): string => `${ref.userAttributes.sub}`;
const getDataFromRef = createGetDataFromRefUsingSignal({
  inner: async (ref: LoginContextValueLoggedIn, signal): Promise<ReminderChannelsInfo> => {
    const resp = await apiFetch(
      '/api/1/users/me/wants_notification_time_prompt',
      {
        method: 'GET',
        signal,
      },
      ref
    );
    if (!resp.ok) {
      throw resp;
    }
    const data = await resp.json();
    return convertUsingMapper(data, reminderChannelsInfoKeyMap);
  },
});
const compareRefs = (a: LoginContextValueLoggedIn, b: LoginContextValueLoggedIn): number =>
  getJwtExpiration(b.authTokens.idToken) - getJwtExpiration(a.authTokens.idToken);
