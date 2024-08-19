import {
  LoginContextValue,
  LoginContextValueLoggedIn,
} from '../../../../../shared/contexts/LoginContext';
import { Visitor } from '../../../../../shared/hooks/useVisitorValueWithCallbacks';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { getOrCreateClientKey } from '../../../../../shared/journals/clientKeys';
import { Callbacks, createWritableValueWithCallbacks } from '../../../../../shared/lib/Callbacks';
import { createFernet } from '../../../../../shared/lib/fernet';
import { getCurrentServerTimeMS } from '../../../../../shared/lib/getCurrentServerTimeMS';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import {
  InfiniteListing,
  NetworkedInfiniteListing,
} from '../../../../../shared/lib/InfiniteListing';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { VISITOR_SOURCE } from '../../../../../shared/lib/visitorSource';
import { waitForValueWithCallbacksConditionCancelable } from '../../../../../shared/lib/waitForValueWithCallbacksCondition';
import { RequestHandler } from '../../../../../shared/requests/RequestHandler';
import { decryptJournalEntryAPI, JournalEntry, JournalEntryAPI } from './JournalEntry';

export type JournalEntryListRequest = {
  /** The user whose journal entries are being fetched */
  user: LoginContextValueLoggedIn;
  /** The visitor */
  visitor: Visitor;
};

export type JournalEntryListMinimalRequest = {
  /** The user whose journal entries are being fetched */
  user: { userAttributes: { sub: string } };
};

/** What this actually produces */
export type JournalEntryListState = {
  /** The sub of the user this listing is for */
  userSub: string;

  /** The underlying listing */
  listing: InfiniteListing<JournalEntry>;

  /**
   * When this list state needs to get a new ref to be valid,
   * in milliseconds since the unix epoch on the servers clock
   */
  expiresAtServerMS: number;
};

/**
 * Creates a request handler that can request the logged in users journal entries
 */
export const createJournalEntryListRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<
  JournalEntryListMinimalRequest,
  JournalEntryListRequest,
  JournalEntryListState
> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: JournalEntryListMinimalRequest): string => ref.user.userAttributes.sub;
const getDataFromRef = createGetDataFromRefUsingSignal<
  JournalEntryListRequest,
  JournalEntryListState
>({
  inner: async (ref, signal) => {
    const active = createWritableValueWithCallbacks(true);
    const unsetActive = () => {
      setVWC(active, false);
    };
    signal.addEventListener('abort', unsetActive);
    if (signal.aborted) {
      unsetActive();
    }

    const visitorNotLoading = waitForValueWithCallbacksConditionCancelable(
      ref.visitor.value,
      (v) => !v.loading
    );
    visitorNotLoading.promise.catch(() => {});
    const canceled = waitForValueWithCallbacksConditionCancelable(active, (v) => !v);
    canceled.promise.catch(() => {});

    await Promise.race([canceled.promise, visitorNotLoading.promise]);

    visitorNotLoading.cancel();

    if (!active.get()) {
      signal.removeEventListener('abort', unsetActive);
      throw new Error('canceled');
    }

    const clientKey = await getOrCreateClientKey(ref.user, ref.visitor);
    const wrappedClientKey = {
      uid: clientKey.uid,
      key: await createFernet(clientKey.key),
    };

    if (!active.get()) {
      signal.removeEventListener('abort', unsetActive);
      throw new Error('canceled');
    }

    const userTokenExpiresAtServer = getJwtExpiration(ref.user.authTokens.idToken);

    const nowServer = await getCurrentServerTimeMS();
    const nowLocal = Date.now();
    const clockDrift = nowServer - nowLocal;
    const userTokenExpiresAtLocal = userTokenExpiresAtServer - clockDrift;

    if (!active.get()) {
      signal.removeEventListener('abort', unsetActive);
      throw new Error('canceled');
    }

    // this is a bit hacky, but we don't want the login value to
    // update automatically; we want the request handler logic to be
    // used instead to ensure we are not mixing up users
    const login: LoginContextValue = {
      value: {
        get: () => {
          if (userTokenExpiresAtLocal <= Date.now()) {
            return { state: 'logged-out' };
          }
          return ref.user;
        },
        callbacks: new Callbacks(), // listing doesn't need real callbacks
      },
      setAuthTokens: () => {
        throw new Error(
          'JournalEntryListRequestHandler#listing#setAuthTokens: not safe to do that'
        );
      },
      setUserAttributes: () => {
        throw new Error(
          'JournalEntryListRequestHandler#listing#setUserAttributes: not safe to do that'
        );
      },
    };

    const listing = new NetworkedInfiniteListing<JournalEntry>(
      '/api/1/journals/entries/search?client_key_uid=' +
        encodeURIComponent(wrappedClientKey.uid) +
        '&platform=' +
        encodeURIComponent(VISITOR_SOURCE),
      150,
      150,
      10,
      {
        flags: {
          mutation: {
            operator: 'and',
            value: 1,
          },
          comparison: {
            operator: 'eq',
            value: 0,
          },
        },
      },
      [
        {
          key: 'canonical_at',
          dir: 'desc',
          before: null,
          after: null,
        },
        {
          key: 'uid',
          dir: 'asc',
          before: null,
          after: null,
        },
      ],
      (item, dir) => {
        return [
          {
            key: 'canonical_at',
            dir: dir === 'before' ? 'asc' : 'desc',
            before: null,
            after: item.payload.canonicalAt.getTime() / 1000,
          },
          {
            key: 'uid',
            dir: dir === 'before' ? 'desc' : 'asc',
            before: null,
            after: item.uid,
          },
        ];
      },
      (raw: any) => {
        const api = raw as JournalEntryAPI;
        return decryptJournalEntryAPI({ api, clientKey: wrappedClientKey });
      },
      login
    );
    listing.reset();
    unsetActive();
    signal.removeEventListener('abort', unsetActive);
    return {
      userSub: ref.user.userAttributes.sub,
      listing,
      expiresAtServerMS: userTokenExpiresAtServer,
    };
  },
  isExpired: (ref, nowServer) => {
    const userExpiresAt = getJwtExpiration(ref.user.authTokens.idToken);
    return userExpiresAt <= nowServer;
  },
});
const compareRefs = (a: JournalEntryListRequest, b: JournalEntryListRequest): number =>
  getJwtExpiration(b.user.authTokens.idToken) - getJwtExpiration(a.user.authTokens.idToken);
