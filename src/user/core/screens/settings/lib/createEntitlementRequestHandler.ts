import { RequestHandler } from '../../../../../shared/requests/RequestHandler';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { LoginContextValueLoggedIn } from '../../../../../shared/contexts/LoginContext';
import { CrudFetcherMapper, convertUsingMapper } from '../../../../../admin/crud/CrudFetcher';

export type EntitlementRef = {
  user: LoginContextValueLoggedIn;
  entitlement: string;
};

type EntitlementAPI =
  | {
      identifier: string;
      is_active: true;
      active_info: {
        recurrence:
          | { type: 'lifetime' }
          | {
              type: 'recurring';
              period: { iso8601: string };
              cycle_ends_at: number;
              auto_renews: boolean;
            };
        platform: 'stripe' | 'ios' | 'google' | 'promotional';
      };
      expiration_date: number | null;
      checked_at: number;
    }
  | {
      identifier: string;
      is_active: false;
      active_info: null;
      expiration_date: number | null;
      checked_at: number;
    };

/**
 * Describes the state of an entitlement for a user at a point in time
 */
export type Entitlement = {
  /** The stable identifier for the entitlement that this describes */
  identifier: string;
  /** True if the user had the entitlement, false otherwise */
  isActive: boolean;
  /** If information about where the entitlement came from is known, some information */
  activeInfo: {
    recurrence:
      | { type: 'lifetime' }
      | {
          type: 'recurring';
          period: { iso8601: string };
          cycleEndsAt: Date;
          autoRenews: boolean;
        };
    platform: 'stripe' | 'ios' | 'google' | 'promotional';
  } | null;
  /** When the entitlement expires if not renewed, if known and relevant */
  expirationDate: Date | null;
  /** When this information was fetched from the source of truth */
  checkedAt: Date;
};

export const entitlementKeyMap: CrudFetcherMapper<Entitlement> = (v: any): Entitlement => {
  const raw = v as EntitlementAPI;
  return {
    identifier: raw.identifier,
    isActive: raw.is_active,
    activeInfo: raw.active_info && {
      recurrence:
        raw.active_info.recurrence.type === 'lifetime'
          ? { type: 'lifetime' }
          : {
              type: 'recurring',
              period: raw.active_info.recurrence.period && {
                iso8601: raw.active_info.recurrence.period.iso8601,
              },
              cycleEndsAt: new Date(raw.active_info.recurrence.cycle_ends_at * 1000),
              autoRenews: raw.active_info.recurrence.auto_renews,
            },
      platform: raw.active_info.platform,
    },
    expirationDate: raw.expiration_date === null ? null : new Date(raw.expiration_date * 1000),
    checkedAt: new Date(raw.checked_at * 1000),
  };
};

/**
 * Creates a request handler for if the given user has the given entitlement
 */
export const createEntitlementsRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<EntitlementRef, EntitlementRef, Entitlement> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: EntitlementRef): string =>
  `${ref.user.userAttributes.sub}:${ref.entitlement}`;
const getDataFromRef = createGetDataFromRefUsingSignal({
  inner: async (ref: EntitlementRef, signal): Promise<Entitlement> => {
    let resp = await apiFetch(
      `/api/1/users/me/entitlements/${ref.entitlement}`,
      {
        method: 'GET',
        headers: {
          Pragma: 'no-cache',
        },
        signal,
      },
      ref.user
    );
    if (resp.status === 429) {
      resp = await apiFetch(
        `/api/1/users/me/entitlements/${ref.entitlement}`,
        {
          method: 'GET',
          signal,
        },
        ref.user
      );
    }
    if (!resp.ok) {
      throw resp;
    }
    const data: EntitlementAPI = await resp.json();
    return convertUsingMapper(data, entitlementKeyMap);
  },
});
const compareRefs = (a: EntitlementRef, b: EntitlementRef): number =>
  getJwtExpiration(b.user.authTokens.idToken) - getJwtExpiration(a.user.authTokens.idToken);
