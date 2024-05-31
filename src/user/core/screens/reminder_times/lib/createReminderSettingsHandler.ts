import { RequestHandler } from '../../../../../shared/requests/RequestHandler';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { LoginContextValueLoggedIn } from '../../../../../shared/contexts/LoginContext';
import { CrudFetcherMapper, convertUsingMapper } from '../../../../../admin/crud/CrudFetcher';
import { Channel } from './Channel';
import { DayOfWeek } from '../../../../../shared/models/DayOfWeek';

export type ReminderSettingsForChannel = {
  /** Seconds since midnight for the earliest they can receive notifications */
  start: number;

  /** Seconds since midnight for the latest they can receive notifications */
  end: number;

  /** The days of the week they can receive notifications */
  days: Set<DayOfWeek>;

  /**
   * True if they configured this value, false if it's the default value.
   */
  isReal: boolean;
};

/**
 * Describes the time of day and days of the week a user receives notifications on each channel.
 * This is independent of if they actually _can_ receive notifications on that channel, i.e.,
 * if they don't have a phone number, they can edit their SMS settings but they still won't
 * receive SMS notifications.
 */
export type ReminderSettings = Record<Channel, ReminderSettingsForChannel>;

export const reminderSettingsKeyMap: CrudFetcherMapper<ReminderSettings> = (raw) => {
  const result = {} as ReminderSettings;
  for (const [channelRaw, settingsRaw] of Object.entries(raw)) {
    const channel = channelRaw as Channel;
    const settings = settingsRaw as any;
    result[channel] = {
      start: settings.start,
      end: settings.end,
      days: new Set(settings.days),
      isReal: settings.is_real,
    };
  }
  return result;
};

/**
 * Creates a request handler for what reminder channels can be configured
 * and which ones haven't been configured ever.
 */
export const createReminderSettingsRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<LoginContextValueLoggedIn, LoginContextValueLoggedIn, ReminderSettings> => {
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
  inner: async (ref: LoginContextValueLoggedIn, signal): Promise<ReminderSettings> => {
    const resp = await apiFetch(
      '/api/1/users/me/daily_reminder_settings',
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
    return convertUsingMapper(data, reminderSettingsKeyMap);
  },
});
const compareRefs = (a: LoginContextValueLoggedIn, b: LoginContextValueLoggedIn): number =>
  getJwtExpiration(b.authTokens.idToken) - getJwtExpiration(a.authTokens.idToken);
