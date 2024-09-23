import { createContext, PropsWithChildren, useCallback, useEffect, useMemo } from 'react';
import { Buffer } from 'buffer';
import { apiFetch } from '../ApiConstants';
import { getCurrentServerTimeMS } from '../lib/getCurrentServerTimeMS';
import {
  Callbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
  ValueWithCallbacks,
} from '../lib/Callbacks';
import { setVWC } from '../lib/setVWC';
import { getJwtExpiration } from '../lib/getJwtExpiration';
import { waitForValueWithCallbacksConditionCancelable } from '../lib/waitForValueWithCallbacksCondition';
import { createCancelableTimeout } from '../lib/createCancelableTimeout';
import { CancelablePromise } from '../lib/CancelablePromise';
import { constructCancelablePromise } from '../lib/CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from '../lib/createCancelablePromiseFromCallbacks';
import { base64URLToByteArray, byteArrayToBase64URL } from '../lib/colorUtils';
import { createRSA4096PrivateKeyPair, decryptRSA4096V1 } from '../lib/rsa';
import { createMaxWorkPerFrameStaller } from '../lib/createMaxWorkPerFrameStaller';
import { createNestableProgress, NestableProgress } from '../lib/createNestableProgress';

/**
 * The user attributes that are available when a user is logged in. When
 * changing user attributes via the backend we may not necessarily regenerate
 * the jwt, hence the jwts values may be stale.
 */
export type UserAttributes = {
  /**
   * The users unique identifier
   */
  sub: string;

  /**
   * The user's email address, if available
   */
  email: string | null;

  /**
   * The users phone number, if available. Most users will not have a phone
   * number available directly from single sign on.
   */
  phoneNumber: string | null;

  /**
   * The users name as they specified it. This is sometimes broken down into
   * givenName and familyName - if we have those we merge them to get name,
   * and if we only have the name we split it so that the first word is the
   * given name. Where we only have name and it's 1 word, the familyName is
   * a blank string.
   *
   * Not always available - in particular, when using Sign in with Apple we
   * will not initially have their name.
   */
  name: string | null;

  /**
   * The users given name, if available. See name for more details.
   */
  givenName: string | null;

  /**
   * The users family name, if available. See name for more details.
   */
  familyName: string | null;
};

const areUserAttributesEqual = (a: UserAttributes, b: UserAttributes): boolean =>
  a.sub === b.sub &&
  a.email === b.email &&
  a.phoneNumber === b.phoneNumber &&
  a.name === b.name &&
  a.givenName === b.givenName &&
  a.familyName === b.familyName;

/**
 * The tokens after logging in.
 */
export type TokenResponseConfig = {
  /**
   * The id token - this is the primary bearer token for interacting with the
   * backend.
   */
  idToken: string;

  /**
   * The refresh token, if available. This can be used to get a new id token
   * for up to 30 days after it was first issued and up to 90 days after the
   * user logged in.
   */
  refreshToken: string | null;
};

/**
 * The login context's provided value when logged in.
 */
export type LoginContextValueLoggedIn = {
  /**
   * The disjoint union tag for the state.
   */
  state: 'logged-in';
  /**
   * The auth tokens that can be used in requests
   */
  authTokens: TokenResponseConfig;
  /**
   * The user attributes for the logged in user, which are based on the
   * claims in the id token, but can be updated independently.
   */
  userAttributes: UserAttributes;
};

/**
 * The login context's provided value when we are in the process of
 * loading from stores, with no more specific info
 */
export type LoginContextValueLoadingDefault = {
  state: 'loading';
  hint: undefined;
};

export type LoginContextValueLoadingSilentAuth = {
  state: 'loading';
  hint: 'silent-auth';
  progress: ValueWithCallbacks<string[]>;
};

export type LoginContextValueLoading =
  | LoginContextValueLoadingDefault
  | LoginContextValueLoadingSilentAuth;

/**
 * The login context's provided value when logged out
 */
export type LoginContextValueLoggedOut = {
  state: 'logged-out';
};

export type LoginContextValueUnion =
  | LoginContextValueLoggedIn
  | LoginContextValueLoading
  | LoginContextValueLoggedOut;

/**
 * The value provided by the login context.
 */
export type LoginContextValue = {
  value: ValueWithCallbacks<LoginContextValueUnion>;

  /**
   * The function to call to set the authtokens to a new value. This will
   * update the state to logged-in if the new value is not null, and
   * logged-out otherwise. This will store the new value in the secure store.
   *
   * If authTokens is null, this will clear userAttributes. Otherwise, this
   * will reset userAttributes to match the claims in the new idToken.
   *
   * This cannot be called during the 'loading' state.
   */
  setAuthTokens: (authTokens: TokenResponseConfig | null) => Promise<void>;

  /**
   * The function to call to set the user attributes to a new value.
   * Raises an error if not logged in.
   */
  setUserAttributes: (userAttributes: UserAttributes) => Promise<void>;

  /**
   * The function to call to set the silent auth preference to a new value.
   */
  setSilentAuthPreference: (preference: SilentAuthPreference | null) => Promise<void>;
};

const defaultProps: LoginContextValue = {
  value: {
    get() {
      throw new Error('attempt to access LoginContextValue defaultProps value.get');
    },
    get callbacks(): Callbacks<undefined> {
      throw new Error('attempt to access LoginContextValue defaultProps value.callbacks');
    },
  },
  setAuthTokens: async () => {
    throw new Error('attempt to setAuthTokens on LoginContextValue defaultProps');
  },
  setUserAttributes: async () => {
    throw new Error('attempt to setUserAttributes on LoginContextValue defaultProps');
  },
  setSilentAuthPreference: async () => {
    throw new Error('attempt to setSilentAuthPreference on LoginContextValue defaultProps');
  },
};

/**
 * A React Context which provides the authTokens required for communicating
 * with the backend.
 *
 * In particular, whenever the backend calls for an "id token", it is referring
 * to the authTokens.idToken.
 *
 * Do NOT use the LoginContext.Provider directly. Instead use the exported
 * LoginProvider.
 */
export const LoginContext: React.Context<LoginContextValue> = createContext(defaultProps);

/**
 * The expected props to the LoginProvider
 */
type LoginProviderProps = {};

/**
 * Extracts the user attributes from the given token response by inspecting
 * the claims for the idToken.
 *
 * @param tokenConfig The token config to use to get the user attributes
 */
export const extractUserAttributes = (tokenConfig: TokenResponseConfig): UserAttributes => {
  // we don't need to verify the idToken since this only effects the client,
  // and they can lie to themselves if they want
  const idToken = tokenConfig.idToken;
  const claimsBase64 = idToken.split('.')[1];
  const claimsJson = Buffer.from(claimsBase64, 'base64').toString('utf8');
  const claims = JSON.parse(claimsJson);

  const nameClaims: { name: string | null; given_name: string | null; family_name: string | null } =
    Object.assign({ name: null, given_name: null, family_name: null }, claims);

  if (
    nameClaims.name === null &&
    (nameClaims.given_name !== null || nameClaims.family_name !== null)
  ) {
    nameClaims.name = (
      (nameClaims.given_name || '') +
      ' ' +
      (nameClaims.family_name || '')
    ).trimEnd();
  }

  if (
    nameClaims.name !== null &&
    (nameClaims.given_name === null || nameClaims.family_name === null)
  ) {
    const spaceIndex = nameClaims.name.indexOf(' ');
    if (spaceIndex !== -1) {
      nameClaims.given_name = nameClaims.name.substring(0, spaceIndex);
      nameClaims.family_name = nameClaims.name.substring(spaceIndex + 1);
    } else {
      nameClaims.given_name = nameClaims.name;
      nameClaims.family_name = '';
    }
  }

  return {
    sub: claims.sub,
    email: claims.email,
    phoneNumber: claims.phone_number || null,
    name: nameClaims.name,
    givenName: nameClaims.given_name,
    familyName: nameClaims.family_name,
  };
};

/**
 * Stores the given auth tokens in the appropriate store.
 *
 * @param authTokens The auth tokens to store
 */
export const storeAuthTokens = async (authTokens: TokenResponseConfig | null) => {
  // We're async for consistency with the react-native app, but there is no async
  // storage interface available

  // note on safari private browsing we can't use local storage so we'll use session
  // storage

  if (authTokens === null) {
    localStorage.removeItem('authTokens');
    sessionStorage.removeItem('authTokens');
  } else {
    try {
      localStorage.setItem('authTokens', JSON.stringify(authTokens));
      sessionStorage.removeItem('authTokens');
    } catch (e) {
      sessionStorage.setItem('authTokens', JSON.stringify(authTokens));
    }
  }
};

/**
 * Retrieves the auth tokens from the appropriate store, stored via storeAuthTokens
 *
 * @returns The auth tokens from the appropriate store
 */
const retrieveAuthTokens = async (): Promise<TokenResponseConfig | null> => {
  // We're async for consistency with the react-native app, but there is no async
  // storage interface available
  let authTokensJson = localStorage.getItem('authTokens');
  if (authTokensJson === null) {
    authTokensJson = sessionStorage.getItem('authTokens');
  }
  if (authTokensJson === null) {
    return null;
  }
  return JSON.parse(authTokensJson);
};

/**
 * Stores the given user attributes in the appropriate store.
 *
 * @param userAttributes The user attributes to store
 */
export const storeUserAttributes = async (userAttributes: UserAttributes | null) => {
  // We're async for consistency with the react-native app, but there is no async
  // storage interface available
  if (userAttributes === null) {
    localStorage.removeItem('userAttributes');
    sessionStorage.removeItem('userAttributes');
  } else {
    try {
      localStorage.setItem('userAttributes', JSON.stringify(userAttributes));
      sessionStorage.removeItem('userAttributes');
    } catch (e) {
      sessionStorage.setItem('userAttributes', JSON.stringify(userAttributes));
    }
  }
};

/**
 * Retrieves the user attributes from the appropriate store, stored via storeUserAttributes
 *
 * @returns The user attributes from the appropriate store
 */
const retrieveUserAttributes = async (): Promise<UserAttributes | null> => {
  // We're async for consistency with the react-native app, but there is no async
  // storage interface available
  let userAttributesJson = localStorage.getItem('userAttributes');
  if (userAttributesJson === null) {
    userAttributesJson = sessionStorage.getItem('userAttributes');
  }
  if (userAttributesJson === null) {
    return null;
  }

  return JSON.parse(userAttributesJson);
};

export type SilentAuthPreferenceNever = {
  /**
   * - `never`: silent auth should not be used
   */
  type: 'never';
};

export type SilentAuthPreferencePreferred = {
  /**
   * - `preferred`: silent auth should be used if possible
   */
  type: 'preferred';
};
export type SilentAuthPreference = SilentAuthPreferenceNever | SilentAuthPreferencePreferred;

export const DEFAULT_SILENT_AUTH_PREFERENCE: SilentAuthPreference = {
  type: 'preferred',
};

export const storeSilentAuthPreference = async (preference: SilentAuthPreference | null) => {
  if (preference !== null) {
    localStorage.setItem('silentAuthPreference', JSON.stringify(preference));
  } else {
    localStorage.removeItem('silentAuthPreference');
  }
};

export const retrieveSilentAuthPreference = async (): Promise<SilentAuthPreference | null> => {
  let preferenceJson = localStorage.getItem('silentAuthPreference');
  if (preferenceJson === null) {
    preferenceJson = sessionStorage.getItem('silentAuthPreference');
  }
  if (preferenceJson === null) {
    return null;
  }

  const result = JSON.parse(preferenceJson);
  if (result.type === 'never' || result.type === 'preferred') {
    return result;
  }
  throw new Error('invalid silent auth preference type');
};

export const isSilentAuthSupported = async (): Promise<boolean> => {
  return true;
};

export type SilentAuthRSA4096V1Key = {
  /**
   * - `rsa-4096-v1`: 4096 bit rsa key, public exponent is 65537, enforces OAEP padding
   */
  type: 'rsa-4096-v1';
  /**
   * The public modulus (which forms the entire public key, given the public exponent is fixed).
   * This is a large value (larger than 2^4096)
   */
  publicModulusB64URL: string;
  /**
   * d = e^-1 mod phi, where phi = lcm(p-1, q-1), where p and q are the prime factors of the
   * public modulus. This has the special property that it "undoes" encryption with the public
   * exponent (mod the public modulus). This is a large value (larger than 2^2048)
   */
  privateExponentB64URL: string;

  /**
   * optional string that can be stored and forwarded for faster challenge solving;
   * typically, this will be a common RSA representation like JWK that can be passed
   * to a native RSA library for faster decryption
   */
  hwAccelInfo?: string;
};

export const getSilentAuthOptions = async (): Promise<SilentAuthRSA4096V1Key[]> => {
  let raw = localStorage.getItem('silentAuthOptions');
  if (raw === null) {
    raw = sessionStorage.getItem('silentAuthOptions');
  }
  if (raw === null) {
    return [];
  }
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    return [];
  }
  const result: SilentAuthRSA4096V1Key[] = [];
  for (const item of parsed) {
    if (typeof item === 'object' && item !== null && item.type === 'rsa-4096-v1') {
      result.push(item);
    }
  }
  return result;
};

export const createSilentAuthOption = async (
  progress: NestableProgress
): Promise<SilentAuthRSA4096V1Key> => {
  return await createRSA4096PrivateKeyPair({
    progress,
    staller: createMaxWorkPerFrameStaller({ maxWorkPerFrameMs: 100, initiallyStall: true }),
    maxTimeMs: 60000,
  });
};

export const storeSilentAuthOptions = async (options: SilentAuthRSA4096V1Key[]) => {
  try {
    localStorage.setItem('silentAuthOptions', JSON.stringify(options));
    sessionStorage.removeItem('silentAuthOptions');
  } catch (e) {
    sessionStorage.setItem('silentAuthOptions', JSON.stringify(options));
  }
};

/** Solves the given challenge to prove we have access to the given option */
export const solveSilentAuthChallenge = async (
  option: SilentAuthRSA4096V1Key,
  challengeB64URL: string
): Promise<string> => {
  const challengeBytes = base64URLToByteArray(challengeB64URL);
  const decrypted = await decryptRSA4096V1(option, challengeBytes);
  return byteArrayToBase64URL(decrypted);
};

/**
 * Returns true if the given token is fresh, false if it is expired or about to
 * expire.
 *
 * @param token The token to check
 * @param nowMs The current server time in milliseconds since the unix epoch
 */
const isTokenFresh = (token: TokenResponseConfig, nowMs: number): boolean => {
  const minExpTime = nowMs + 1000 * 60 * 5;

  const claimsBase64 = token.idToken.split('.')[1];
  const claimsJson = Buffer.from(claimsBase64, 'base64').toString('utf8');
  const claims = JSON.parse(claimsJson);
  return claims.exp * 1000 > minExpTime;
};

/**
 * Determines if it's possible to refresh the id token in the given response
 *
 * @param token The token to check
 * @param nowMs The current server time in milliseconds since the unix epoch
 * @returns True if the token is refreshable, false otherwise
 */
const isRefreshable = (token: TokenResponseConfig, nowMs: number): boolean => {
  if (token.refreshToken === null) {
    return false;
  }

  const maxIat = nowMs - 1000 * 60 * 10;
  const minExpTime = nowMs + 1000 * 60 * 5;
  const minOgExpTime = nowMs - 1000 * 60 * 60 * 24 * 60 + 1000 * 60 * 5;

  const refreshClaimsBase64 = token.refreshToken.split('.')[1];
  const refreshClaimsJson = Buffer.from(refreshClaimsBase64, 'base64').toString('utf8');
  const refreshClaims = JSON.parse(refreshClaimsJson);

  if (refreshClaims.iat <= 1679589900) {
    // tokens with an iat at or below this time were revoked
    return false;
  }

  const refreshable =
    refreshClaims.exp * 1000 > minExpTime &&
    refreshClaims['oseh:og_exp'] * 1000 > minOgExpTime &&
    refreshClaims.iat * 1000 < maxIat;

  return refreshable;
};

/**
 * Attempts to refresh the given tokens, returning the new tokens on success
 * and rejecting the promise on failure.
 *
 * @param oldTokens The tokens to refresh
 * @returns The new tokens
 */
const refreshTokens = async (oldTokens: TokenResponseConfig): Promise<TokenResponseConfig> => {
  const response = await apiFetch(
    '/api/1/oauth/refresh',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        refresh_token: oldTokens.refreshToken,
      }),
    },
    null
  );

  if (!response.ok) {
    throw response;
  }

  const data: { id_token: string; refresh_token: string } = await response.json();
  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
  };
};

/**
 * web-only; determines the appropriate event and state key to use for
 * checking visibility, if one exists
 */
const getVisibilityKeys = (): {
  visibilityChange: string;
  hidden: string & keyof Document;
} | null => {
  let visibilityEventKey: string | null = null;
  let visibilityStateKey: keyof Document | null = null;
  for (let [stateKey, eventKey] of [
    ['hidden', 'visibilitychange'],
    ['webkitHidden', 'webkitvisibilitychange'],
    ['mozHidden', 'mozvisibilitychange'],
    ['msHidden', 'msvisibilitychange'],
  ]) {
    if (stateKey in document) {
      visibilityEventKey = eventKey;
      visibilityStateKey = stateKey as keyof Document;
      return {
        visibilityChange: visibilityEventKey,
        hidden: visibilityStateKey,
      };
    }
  }
  return null;
};

/**
 * Determines if it's possible to check if the tab is active / we're in the
 * foreground, or some good enough proxy.
 *
 * @returns True if we can check if we're in the foreground, false otherwise
 */
export const canCheckForegrounded = async () => {
  return getVisibilityKeys() !== null;
};

/**
 * Checks if we're currently foregrounded. The behavior of this function
 * if canCheckForegrounded returns false is undefined.
 *
 * @returns True if we're foregrounded, false otherwise
 */
export const isForegrounded = async () => {
  const keys = getVisibilityKeys();
  if (keys === null) {
    throw new Error('Cannot check foregrounded state');
  }

  return !document[keys.hidden];
};

export type ForegroundChangedIdentifier = () => void;

/**
 * Adds the given listener to be called when the foregrounded state changes.
 * The behavior of this function if canCheckForegrounded returns false is
 * undefined.
 *
 * @param listener The listener to add
 * @returns The thing to pass to removeForegroundChangedListener to remove
 */
export const addForegroundChangedListener = async (
  listener: () => void
): Promise<ForegroundChangedIdentifier> => {
  const keys = getVisibilityKeys();
  if (keys === null) {
    throw new Error('Cannot check foregrounded state');
  }

  document.addEventListener(keys.visibilityChange, listener);
  return listener;
};

/**
 * Removes the given listener from the foregrounded state change listeners.
 * The behavior of this function if canCheckForegrounded returns false is
 * undefined.
 *
 * @param listener The listener to remove
 */
export const removeForegroundChangedListener = async (listener: ForegroundChangedIdentifier) => {
  const keys = getVisibilityKeys();
  if (keys === null) {
    throw new Error('Cannot check foregrounded state');
  }

  document.removeEventListener(keys.visibilityChange, listener);
};

type LoginContextQueueItemSetAuthTokens = {
  type: 'setAuthTokens';
  /**
   * Returns the new auth tokens that should be used based on the old
   * login context value state.
   *
   * Returns a TokenResponseConfig to replace the tokens and update the
   * user attributes based on the extracted claims. Returns null to logout,
   * deleting any stored tokens or user attributes. Returns undefined to
   * skip the operation (e.g., because the login context value is not what
   * you expected)
   */
  authTokens: (old: LoginContextValueUnion) => TokenResponseConfig | null | undefined;
  /**
   * a function to call when this queue item has been processed
   */
  onDone: () => void;
};

type LoginContextQueueItemSetUserAttributes = {
  type: 'setUserAttributes';
  /**
   * Returns the new user attributes to use temporarily until the id token is
   * refreshed, based on the old login context value state.
   *
   * Returns a UserAttributes to replace the user attributes. Returns undefined
   * to skip the operation, e.g., because the login context value is not what
   * you expected.
   *
   * This function is not called if, by the time this operation is processed,
   * the login context value is not in the logged-in state.
   *
   * @param old The old login context value.
   * @returns The new user attributes to use temporarily
   */
  userAttributes: (old: LoginContextValueLoggedIn) => UserAttributes | undefined;
  /**
   * a function to call when this queue item has been processed
   */
  onDone: () => void;
};

type LoginContextQueueItemSetSilentAuthPreference = {
  type: 'setSilentAuthPreference';
  /**
   * Returns the new silent auth preference to use based on the old login context value state.
   *
   * Returns a SilentAuthPreference to replace the preference. Returns undefined to skip the operation,
   * e.g., because the login context value is not what you expected.
   *
   * @param old The old login context value.
   * @param oldPreference The old silent auth preference.
   * @returns The new silent auth preference to use
   */
  silentAuthPreference: (
    old: LoginContextValueUnion,
    oldPreference: SilentAuthPreference | null
  ) => SilentAuthPreference | null | undefined;
  /**
   * a function to call when this queue item has been processed
   */
  onDone: () => void;
};

type LoginContextQueueItem =
  | LoginContextQueueItemSetAuthTokens
  | LoginContextQueueItemSetUserAttributes
  | LoginContextQueueItemSetSilentAuthPreference;

const __globalLoginStateLockedVWC = createWritableValueWithCallbacks(false);

const acquireGlobalLoginStateAndStorageLock = (): CancelablePromise<{ release: () => void }> => {
  return constructCancelablePromise({
    body: async (state, resolve, reject) => {
      const inactive = createCancelablePromiseFromCallbacks(state.cancelers);
      inactive.promise.catch(() => {});
      if (state.finishing) {
        inactive.cancel();
        state.done = true;
        reject(new Error('canceled'));
        return;
      }

      while (true) {
        const tabNotLockedCancelable = waitForValueWithCallbacksConditionCancelable(
          __globalLoginStateLockedVWC,
          (v) => !v
        );
        tabNotLockedCancelable.promise.catch(() => {});
        await Promise.race([inactive.promise, tabNotLockedCancelable.promise]);
        tabNotLockedCancelable.cancel();

        if (state.finishing) {
          inactive.cancel();
          state.done = true;
          reject(new Error('canceled'));
          return;
        }

        if (!__globalLoginStateLockedVWC.get()) {
          __globalLoginStateLockedVWC.set(true);
          __globalLoginStateLockedVWC.callbacks.call(undefined);
          break;
        }
      }

      // WEB ONLY -> acquire web lock if supported; 20s timeout
      if (
        window &&
        window.navigator &&
        window.navigator.locks &&
        typeof window.navigator.locks.request === 'function'
      ) {
        let lockInstantlyReleased = false;
        let releaseLock = () => {
          lockInstantlyReleased = true;
        };
        const lockPromise = new Promise<void>((resolve) => {
          if (lockInstantlyReleased) {
            resolve();
            return;
          }
          releaseLock = resolve;
        });

        let lockInstantlyAcquired = false;
        let onAcquiredLock = () => {
          lockInstantlyAcquired = true;
        };
        const acquiredPromise = new Promise<void>((resolve) => {
          if (lockInstantlyAcquired) {
            resolve();
            return;
          }
          onAcquiredLock = resolve;
        });

        const controller = new AbortController();

        console.log('requesting loginContext WebLock');
        window.navigator.locks.request(
          'loginContext',
          {
            signal: controller.signal,
          },
          async () => {
            onAcquiredLock();
            await lockPromise;
          }
        );

        const acquireTimeout = createCancelableTimeout(20000);
        await Promise.race([acquiredPromise, inactive.promise, acquireTimeout.promise]);
        if (state.finishing) {
          console.log('aborted before receiving loginContext WebLock, aborting request');
          controller.abort();
          releaseLock();
          state.done = true;
          reject(new Error('canceled'));
          return;
        }

        if (acquireTimeout.done()) {
          console.log('timed out waiting for loginContext WebLock, stealing and failing');
          controller.abort();
          releaseLock();
          await window.navigator.locks.request('loginContext', { steal: true }, async () => {
            console.log('successfully unlocked loginContext lock');
          });
          state.finishing = true;
          state.done = true;
          reject(new Error('timed out'));
          return;
        }

        console.log('acquired loginContext WebLock');
        state.finishing = true;
        inactive.cancel();
        state.done = true;
        resolve({
          release: () => {
            console.log('releasing loginContext WebLock');
            releaseLock();
            __globalLoginStateLockedVWC.set(false);
            __globalLoginStateLockedVWC.callbacks.call(undefined);
          },
        });
        return;
      }

      // NATIVE AND WEB FALLBACK -> only use global variable lock
      state.finishing = true;
      inactive.cancel();
      state.done = true;
      resolve({
        release: () => {
          __globalLoginStateLockedVWC.set(false);
          __globalLoginStateLockedVWC.callbacks.call(undefined);
        },
      });
    },
  });
};

const ifDev =
  process.env.REACT_APP_ENVIRONMENT === 'dev'
    ? (fn: () => void): void => {
        fn();
      }
    : (_fn: () => void): void => {};

/**
 * A provider for the LoginContext. This is responsible for loading the auth
 * tokens. The auth tokens will only be provided if they are reasonably fresh;
 * otherwise, this will provide the logged-out state.
 */
export const LoginProvider = ({
  children,
}: PropsWithChildren<LoginProviderProps>): React.ReactElement => {
  const valueVWC = useWritableValueWithCallbacks<LoginContextValueUnion>(() => ({
    state: 'loading',
    hint: undefined,
  }));

  const queueVWC = useWritableValueWithCallbacks<LoginContextQueueItem[]>(() => []);

  const setAuthTokens = useCallback(
    (authTokens: TokenResponseConfig | null): Promise<void> => {
      let immediatelyResolved = false;
      let resolve: () => void = () => {
        immediatelyResolved = true;
      };
      const result = new Promise<void>((r) => {
        if (immediatelyResolved) {
          r();
          return;
        }

        resolve = r;
      });

      const oldValue = valueVWC.get();

      const q = queueVWC.get();
      q.push({
        type: 'setAuthTokens',
        authTokens: () => {
          if (authTokens === null || Object.is(valueVWC.get(), oldValue)) {
            return authTokens;
          }
          return undefined;
        },
        onDone: resolve,
      });
      queueVWC.callbacks.call(undefined);
      return result;
    },
    [queueVWC, valueVWC]
  );

  const setUserAttributes = useCallback(
    async (userAttributes: UserAttributes): Promise<void> => {
      let immediatelyResolved = false;
      let resolve: () => void = () => {
        immediatelyResolved = true;
      };
      const result = new Promise<void>((r) => {
        if (immediatelyResolved) {
          r();
          return;
        }

        resolve = r;
      });

      const oldValue = valueVWC.get();

      const q = queueVWC.get();
      q.push({
        type: 'setUserAttributes',
        userAttributes: () => {
          if (!Object.is(valueVWC.get(), oldValue)) {
            return undefined;
          }

          return userAttributes;
        },
        onDone: resolve,
      });
      queueVWC.callbacks.call(undefined);
      return result;
    },
    [queueVWC, valueVWC]
  );

  const setSilentAuthPreference = useCallback(
    (newPreference: SilentAuthPreference | null): Promise<void> => {
      let immediatelyResolved = false;
      let resolve: () => void = () => {
        immediatelyResolved = true;
      };
      const result = new Promise<void>((r) => {
        if (immediatelyResolved) {
          r();
          return;
        }

        resolve = r;
      });

      const oldValue = valueVWC.get();

      const q = queueVWC.get();
      q.push({
        type: 'setSilentAuthPreference',
        silentAuthPreference: () => {
          if (Object.is(valueVWC.get(), oldValue)) {
            return newPreference;
          }
          return undefined;
        },
        onDone: resolve,
      });
      queueVWC.callbacks.call(undefined);
      return result;
    },
    [queueVWC, valueVWC]
  );

  useEffect(() => {
    const __logId = 'LoginContext-' + Math.random().toString(36).substring(7);
    ifDev(() => console.log(`${__logId}: starting effect`));
    const active = createWritableValueWithCallbacks(true);
    handleLoginStateForever();
    return () => {
      ifDev(() => console.log(`${__logId}: canceling effect`));
      setVWC(active, false);
    };

    async function handleLoginStateForever() {
      ifDev(() => console.log(`${__logId}: initializing loop`));
      while (true) {
        ifDev(() => console.log(`${__logId}: starting loop`));
        if (!active.get()) {
          ifDev(() => console.log(`${__logId}: exiting (effect canceled)`));
          return;
        }

        if ((await checkQueue()) === 'continue') {
          ifDev(() => console.log(`${__logId}: continue after checkQueue`));
          continue;
        }

        if ((await handleLoading()) === 'continue') {
          ifDev(() => console.log(`${__logId}: continue after handleLoading`));
          continue;
        }

        if ((await handleLoggedIn()) === 'continue') {
          ifDev(() => console.log(`${__logId}: continue after handleLoggedIn`));
          continue;
        }

        if ((await handleLoggedOut()) === 'continue') {
          ifDev(() => console.log(`${__logId}: continue after handleLoggedOut`));
          continue;
        }

        ifDev(() =>
          console.log(
            `${__logId}: loop falling through; this is unexpected, adding short delay to avoid cpu hogging`
          )
        );
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    async function checkQueue(): Promise<'continue' | 'fallthrough'> {
      if (!active.get()) {
        return 'continue';
      }

      const q = queueVWC.get();
      if (q.length === 0) {
        ifDev(() => console.log(`${__logId}: queue is empty`));
        return 'fallthrough';
      }

      const inactive = waitForValueWithCallbacksConditionCancelable(active, (v) => !v);
      inactive.promise.catch(() => {});
      const stateLocked = acquireGlobalLoginStateAndStorageLock();
      ifDev(() =>
        console.log(`${__logId}: check queue waiting for canceled or global lock acquired`)
      );
      await Promise.race([inactive.promise, stateLocked.promise.catch(() => {})]);
      ifDev(() => console.log(`${__logId}: check queue done waiting`));
      stateLocked.cancel();

      let lockResult: Awaited<typeof stateLocked.promise>;
      try {
        lockResult = await stateLocked.promise;
      } catch (e) {
        if (e instanceof Error && e.message === 'canceled') {
          if (!active.get()) {
            ifDev(() => console.log(`${__logId}: check queue canceled normally`));
            return 'continue';
          } else {
            ifDev(() =>
              console.log(
                `${__logId}: check queue: global lock canceled, but still active: unexpected but not dangerous`
              )
            );
            inactive.cancel();
            return 'continue';
          }
        }

        ifDev(() =>
          console.warn(
            `${__logId}: check queue: unexpected error acquiring lock; waiting 1s before continuing`,
            e
          )
        );
        const wait = createCancelableTimeout(1000);
        wait.promise.catch(() => {});
        await Promise.race([wait.promise, inactive.promise]);
        wait.cancel();
        inactive.cancel();
        return 'continue';
      }

      ifDev(() => console.log(`${__logId}: check queue acquired global lock`));

      // We have the global lock; we ignore active until we finish this operation.
      // we must recheck stored values as they may have changed.
      try {
        inactive.cancel();

        await assignValueFromStorageRefreshingIfNecessaryWithGlobalLock();
        const oldValue = valueVWC.get();
        const item = q.shift();
        if (item === undefined) {
          ifDev(() =>
            console.warn(
              `${__logId}: queue size was reduced outside checkQueue; this is unexpected but not dangerous`
            )
          );
          return 'continue';
        }

        // we shifted queue, so invoke callbacks
        queueVWC.callbacks.call(undefined);

        switch (item.type) {
          case 'setAuthTokens':
            try {
              ifDev(() => console.debug(`${__logId}: processing setAuthTokens message`));
              const newTokens = item.authTokens(valueVWC.get());
              if (newTokens === undefined) {
                ifDev(() =>
                  console.debug(`${__logId}: skipping setAuthTokens (returned undefined)`)
                );
                break;
              }
              if (newTokens === null) {
                ifDev(() =>
                  console.debug(`${__logId}: logging out and disabling silent auth (returned null)`)
                );
                await storeAuthTokens(null);
                await storeUserAttributes(null);
                await storeSilentAuthPreference({ type: 'never' });
                setVWC(valueVWC, { state: 'logged-out' }, (a, b) => a.state === b.state);
                break;
              }

              ifDev(() => console.debug(`${__logId}: logging in via provided tokens`));
              const userAttributes = extractUserAttributes(newTokens);
              await storeAuthTokens(newTokens);
              await storeUserAttributes(userAttributes);
              setVWC(
                valueVWC,
                {
                  state: 'logged-in',
                  authTokens: newTokens,
                  userAttributes,
                },
                () => false
              );
              break;
            } finally {
              item.onDone();
            }
          case 'setUserAttributes':
            try {
              if (oldValue.state !== 'logged-in') {
                ifDev(() =>
                  console.debug(`${__logId}: skipping setUserAttributes (not logged in)`)
                );
                break;
              }

              ifDev(() => console.debug(`${__logId}: processing setUserAttributes message`));
              const newAttributes = item.userAttributes(oldValue);
              if (newAttributes === undefined) {
                ifDev(() =>
                  console.debug(`${__logId}: skipping setUserAttributes (returned undefined)`)
                );
                break;
              }

              ifDev(() => console.debug(`${__logId}: setting user attributes`));
              await storeUserAttributes(newAttributes);
              setVWC(
                valueVWC,
                {
                  state: 'logged-in',
                  authTokens: oldValue.authTokens,
                  userAttributes: newAttributes,
                },
                () => false
              );
            } finally {
              item.onDone();
            }
            break;
          case 'setSilentAuthPreference':
            ifDev(() => console.log(`${__logId}: processing setSilentAuthPreference message`));

            let oldSilentAuthPreference: SilentAuthPreference | null = null;
            try {
              oldSilentAuthPreference = await retrieveSilentAuthPreference();
            } catch (e) {
              ifDev(() =>
                console.warn(
                  `${__logId}: error retrieving silent auth preference; treating as null`,
                  e
                )
              );
            }

            try {
              const newPreference = item.silentAuthPreference(
                valueVWC.get(),
                oldSilentAuthPreference
              );
              if (newPreference === undefined) {
                ifDev(() =>
                  console.debug(`${__logId}: skipping setSilentAuthPreference (returned undefined)`)
                );
                break;
              }

              if (newPreference === null) {
                ifDev(() => console.debug(`${__logId}: clearing silent auth preference`));
                await storeSilentAuthPreference(null);
              } else {
                ifDev(() =>
                  console.debug(
                    `${__logId}: setting silent auth preference to ${newPreference.type}`
                  )
                );
                await storeSilentAuthPreference(newPreference);
              }

              ifDev(() =>
                console.debug(`${__logId}: since silent auth preference changed, resyncing storage`)
              );
              await assignValueFromStorageRefreshingIfNecessaryWithGlobalLock();
            } finally {
              item.onDone();
            }
            break;
          default:
            ifDev(() => console.warn(`${__logId}: unknown queue item type ${item}`));
            break;
        }
        return 'continue';
      } catch (e) {
        ifDev(() => console.warn(`${__logId}: error processing queue item`, e));
        return 'continue';
      } finally {
        ifDev(() => console.log(`${__logId}: check queue releasing global lock`));
        lockResult.release();
      }
    }

    async function handleLoading(): Promise<'continue' | 'fallthrough'> {
      if (!active.get()) {
        return 'continue';
      }

      if (valueVWC.get().state !== 'loading') {
        ifDev(() => console.log(`${__logId}: not in loading state`));
        return 'fallthrough';
      }

      ifDev(() => console.log(`${__logId}: handleLoading peeked a loading state`));
      await acquireGlobalLockAndSyncState();
      return 'continue';
    }

    async function handleLoggedIn(): Promise<'continue' | 'fallthrough'> {
      const oldValue = valueVWC.get();
      if (oldValue.state !== 'logged-in') {
        ifDev(() => console.log(`${__logId}: not in logged-in state`));
        return 'fallthrough';
      }

      // We are waiting for either a queue item or a refresh to be necessary.
      const idTokenExpiresAtServer = getJwtExpiration(oldValue.authTokens.idToken);
      const nowServer = await getCurrentServerTimeMS();
      const msUntilIdTokenExpires = idTokenExpiresAtServer - nowServer;
      const msUntilRefresh = msUntilIdTokenExpires - 1000 * 60 * 5;

      const shouldRefreshCancelable =
        msUntilRefresh <= 0
          ? {
              promise: Promise.resolve(),
              done: () => true,
              cancel: () => {},
            }
          : createCancelableTimeout(msUntilRefresh);
      shouldRefreshCancelable.promise.catch(() => {});

      const queueHasItemCancelable = waitForValueWithCallbacksConditionCancelable(
        queueVWC,
        (q) => q.length > 0
      );
      queueHasItemCancelable.promise.catch(() => {});

      const inactiveCancelable = waitForValueWithCallbacksConditionCancelable(active, (v) => !v);
      inactiveCancelable.promise.catch(() => {});

      ifDev(() =>
        console.log(
          `${__logId}: peeked logged-in state; waiting for need to refresh, queue changed, or effect canceled`
        )
      );
      await Promise.race([
        shouldRefreshCancelable.promise,
        queueHasItemCancelable.promise,
        inactiveCancelable.promise,
      ]);
      ifDev(() =>
        console.log(`${__logId}: detected need to refresh, queue changed, or effect canceled`)
      );
      shouldRefreshCancelable.cancel();
      queueHasItemCancelable.cancel();
      inactiveCancelable.cancel();

      if (!active.get()) {
        ifDev(() => console.log(`${__logId}: detected effect canceled`));
        return 'continue';
      }

      if (queueVWC.get().length > 0) {
        ifDev(() => console.log(`${__logId}: detected queue changed`));
        return 'continue';
      }

      ifDev(() => console.log(`${__logId}: detected need to refresh`));
      await acquireGlobalLockAndSyncState();
      return 'continue';
    }

    async function handleLoggedOut(): Promise<'continue' | 'fallthrough'> {
      if (valueVWC.get().state !== 'logged-out') {
        ifDev(() => console.log(`${__logId}: not in logged-out state`));
        return 'fallthrough';
      }

      const inactive = waitForValueWithCallbacksConditionCancelable(active, (v) => !v);
      inactive.promise.catch(() => {});
      const queueHasItem = waitForValueWithCallbacksConditionCancelable(
        queueVWC,
        (q) => q.length > 0
      );
      queueHasItem.promise.catch(() => {});
      ifDev(() =>
        console.log(
          `${__logId}: peeked logged-out state; waiting for a queue item or effect canceled`
        )
      );
      await Promise.race([inactive.promise, queueHasItem.promise]);
      ifDev(() => console.log(`${__logId}: detected queue item or effect canceled`));
      inactive.cancel();
      queueHasItem.cancel();

      if (!active.get()) {
        ifDev(() => console.log(`${__logId}: detected effect canceled`));
        return 'continue';
      }

      if (queueVWC.get().length > 0) {
        ifDev(() => console.log(`${__logId}: detected queue item`));
        return 'continue';
      }

      ifDev(() =>
        console.log(
          `${__logId}: a promise resolved but not sure which; this is unexpected but not dangerous, continuing`
        )
      );
      return 'continue';
    }

    /**
     * Attempts to acquire the global lock and sync the state with the storage.
     * This will cancel if the effect is canceled before the global lock is acquired,
     * and we are successfully able to cancel the request for the global lock.
     */
    async function acquireGlobalLockAndSyncState() {
      const inactive = waitForValueWithCallbacksConditionCancelable(active, (v) => !v);
      inactive.promise.catch(() => {});
      const stateLocked = acquireGlobalLoginStateAndStorageLock();
      ifDev(() =>
        console.log(
          `${__logId}: acquireGlobalLockAndSyncState - waiting for canceled or global lock acquired`
        )
      );
      await Promise.race([inactive.promise, stateLocked.promise.catch(() => {})]);
      ifDev(() => console.log(`${__logId}: done waiting`));
      stateLocked.cancel();

      let lockResult: Awaited<typeof stateLocked.promise>;
      try {
        lockResult = await stateLocked.promise;
      } catch (e) {
        if (e instanceof Error && e.message === 'canceled') {
          if (!active.get()) {
            ifDev(() => console.log(`${__logId}: canceled normally`));
            return;
          } else {
            ifDev(() =>
              console.log(
                `${__logId}: handleLoggedIn: global lock canceled, but still active: unexpected but not dangerous`
              )
            );
            inactive.cancel();
            return;
          }
        }

        ifDev(() =>
          console.warn(
            `${__logId}: unexpected error acquiring global lock; waiting 1s before continuing`,
            e
          )
        );
        const wait = createCancelableTimeout(1000);
        wait.promise.catch(() => {});
        await Promise.race([wait.promise, inactive.promise]);
        wait.cancel();
        inactive.cancel();
        return;
      }

      ifDev(() => console.log(`${__logId}: acquired global lock`));
      try {
        inactive.cancel();
        await assignValueFromStorageRefreshingIfNecessaryWithGlobalLock();
      } catch (e) {
        ifDev(() => console.warn(`${__logId}: error syncing state`, e));
        return 'continue';
      } finally {
        ifDev(() => console.log(`${__logId}: releasing global lock`));
        lockResult.release();
      }
    }

    /**
     * Ensures valueVWC matches whats in the storage; this needs to be done
     * whenever acquiring the global lock as the value in storage is only
     * guarranteed not to be changed without callbacks when the global lock is
     * held.
     */
    async function assignValueFromStorageRefreshingIfNecessaryWithGlobalLock() {
      let authTokens: Awaited<ReturnType<typeof retrieveAuthTokens>>;
      let userAttributes: Awaited<ReturnType<typeof retrieveUserAttributes>>;
      try {
        ifDev(() => console.log(`${__logId}: checking storage for auth tokens`));
        authTokens = await retrieveAuthTokens();
        ifDev(() => console.log(`${__logId}: checking storage for user attributes`));
        userAttributes = await retrieveUserAttributes();
      } catch (e) {
        ifDev(() => console.error(`${__logId}: error loading state; trying to clear`, e));
        try {
          ifDev(() => console.log(`${__logId}: trying to clear auth tokens`));
          await storeAuthTokens(null);
          ifDev(() => console.log(`${__logId}: successfully cleared auth tokens`));
        } catch (e2) {
          ifDev(() => console.error(`${__logId}: error clearing auth tokens`, e2));
        }
        try {
          ifDev(() => console.log(`${__logId}: trying to clear user attributes`));
          await storeUserAttributes(null);
          ifDev(() => console.log(`${__logId}: successfully cleared user attributes`));
        } catch (e2) {
          ifDev(() => console.error(`${__logId}: error clearing user attributes`, e2));
        }

        ifDev(() =>
          console.log(`${__logId} continuing as if stored state was a consistent logged-out state`)
        );
        authTokens = null;
        userAttributes = null;
      }

      if (authTokens === null && userAttributes !== null) {
        ifDev(() =>
          console.log(
            `${__logId}: stored state is inconsistent (no tokens, have user attributes); clearing user attributes and treating as null`
          )
        );
        try {
          await storeUserAttributes(null);
          ifDev(() => console.log(`${__logId}: successfully cleared user attributes`));
        } catch (e) {
          ifDev(() => console.error(`${__logId}: error clearing user attributes`, e));
        }
        userAttributes = null;
      }

      if (authTokens !== null && userAttributes === null) {
        ifDev(() =>
          console.log(
            `${__logId}: stored state is inconsistent (have tokens, no user attributes); clearing tokens and treating as null`
          )
        );
        try {
          await storeAuthTokens(null);
          ifDev(() => console.log(`${__logId}: successfully cleared auth tokens`));
        } catch (e) {
          ifDev(() => console.error(`${__logId}: error clearing auth tokens`, e));
        }
        authTokens = null;
      }

      if (authTokens === null && userAttributes === null) {
        const silentAuthValue = await maybeLoginViaSilentAuthWithGlobalLock();
        if (silentAuthValue !== null) {
          [authTokens, userAttributes] = silentAuthValue;
        }
      }

      if (authTokens === null || userAttributes === null) {
        ifDev(() => console.log(`${__logId}: stored state indicates logged out`));
        if (valueVWC.get().state !== 'logged-out') {
          ifDev(() => console.log(`${__logId}: switching to logged-out`));
          valueVWC.set({ state: 'logged-out' });
          valueVWC.callbacks.call(undefined);
        } else {
          ifDev(() => console.log(`${__logId}: already in logged-out state`));
        }
        return;
      }

      ifDev(() =>
        console.log(`${__logId}: have stored state: consistent logged-in; checking freshness`)
      );
      const nowServerMS = await getCurrentServerTimeMS();
      if (isTokenFresh(authTokens, nowServerMS)) {
        ifDev(() => console.log(`${__logId}: tokens are fresh`));

        const oldValue = valueVWC.get();
        if (
          oldValue.state !== 'logged-in' ||
          oldValue.authTokens.idToken !== authTokens.idToken ||
          oldValue.authTokens.refreshToken !== authTokens.refreshToken ||
          !areUserAttributesEqual(oldValue.userAttributes, userAttributes)
        ) {
          ifDev(() => console.log(`${__logId}: switching to logged-in`));
          valueVWC.set({
            state: 'logged-in',
            authTokens,
            userAttributes,
          });
          valueVWC.callbacks.call(undefined);
        } else {
          ifDev(() => console.log(`${__logId}: already in matching logged-in state`));
        }
        return 'continue';
      }

      ifDev(() => console.log(`${__logId}: tokens are stale; checking refreshability`));
      if (isRefreshable(authTokens, nowServerMS)) {
        ifDev(() => console.log(`${__logId}: tokens are refreshable; using refreshWithGlobalLock`));
        await refreshWithGlobalLock(authTokens);
        return;
      }

      ifDev(() => console.log(`${__logId}: tokens cannot be refreshed; clearing`));
      try {
        ifDev(() => console.log(`${__logId}: trying to clear auth tokens`));
        await storeAuthTokens(null);
        ifDev(() => console.log(`${__logId}: successfully cleared auth tokens`));
      } catch (e) {
        ifDev(() => console.error(`${__logId}: error clearing auth tokens`, e));
      }

      try {
        ifDev(() => console.log(`${__logId}: trying to clear user attributes`));
        await storeUserAttributes(null);
        ifDev(() => console.log(`${__logId}: successfully cleared user attributes`));
      } catch (e) {
        ifDev(() => console.error(`${__logId}: error clearing user attributes`, e));
      }

      if (valueVWC.get().state !== 'logged-out') {
        ifDev(() => console.log(`${__logId}: switching to logged-out`));
        valueVWC.set({ state: 'logged-out' });
        valueVWC.callbacks.call(undefined);
      } else {
        ifDev(() => console.log(`${__logId}: already in logged-out state`));
      }
    }

    /** Does NOT update valueVWC, but does update stored */
    async function maybeLoginViaSilentAuthWithGlobalLock(
      alreadyRegistered?: boolean
    ): Promise<[TokenResponseConfig, UserAttributes] | null> {
      if (!(await isSilentAuthSupported())) {
        ifDev(() => console.log(`${__logId}: silentauth is not supported`));
        return null;
      }

      let silentAuthPreference: Awaited<ReturnType<typeof retrieveSilentAuthPreference>>;
      try {
        silentAuthPreference = await retrieveSilentAuthPreference();
      } catch (e) {
        ifDev(() =>
          console.error(
            `${__logId}: error loading silent auth preference; clearing and treating as null`,
            e
          )
        );
        try {
          await storeSilentAuthPreference(null);
          ifDev(() => console.log(`${__logId}: successfully cleared silent auth preference`));
        } catch (e2) {
          ifDev(() => console.error(`${__logId}: error clearing silent auth preference`, e2));
        }
        silentAuthPreference = null;
      }

      if (silentAuthPreference === null) {
        ifDev(() => console.log(`${__logId}: silent auth preference is null, using default`));
        silentAuthPreference = DEFAULT_SILENT_AUTH_PREFERENCE;
      }

      ifDev(() =>
        console.log(`${__logId}: silent auth preference is ${JSON.stringify(silentAuthPreference)}`)
      );
      if (silentAuthPreference.type !== 'preferred') {
        return null;
      }

      try {
        ifDev(() => console.log(`${__logId}: retrieving silent auth options @ ${Date.now()}`));
        const silentAuthOptions = await getSilentAuthOptions();
        ifDev(() =>
          console.log(
            `${__logId}: retrieved ${silentAuthOptions.length} silent auth options @ ${Date.now()}`
          )
        );

        const progress = createNestableProgress();
        valueVWC.set({
          state: 'loading',
          hint: 'silent-auth',
          progress: progress.current,
        });
        valueVWC.callbacks.call(undefined);

        if (silentAuthOptions.length === 0) {
          ifDev(() =>
            console.log(
              `${__logId}: no silent auth options available, creating one @ ${Date.now()}`
            )
          );
          const option = await createSilentAuthOption(progress);
          silentAuthOptions.push(option);
          ifDev(() =>
            console.log(`${__logId}: created silent auth option, storing @ ${Date.now()}`)
          );
          await storeSilentAuthOptions(silentAuthOptions);
        }
        const option = silentAuthOptions[0];
        ifDev(() =>
          console.log(
            `${__logId}: retrieved silent auth options, requesting challenge for ${
              option.publicModulusB64URL
            } @ ${Date.now()}`
          )
        );

        const challengeApiResponse = await progress.withNestedAsync('requesting challenge', () =>
          apiFetch(
            '/api/1/oauth/silent/begin',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
              },
              body: JSON.stringify({
                type: option.type,
                public_key_b64url: option.publicModulusB64URL,
              }),
            },
            null
          )
        );
        if (!challengeApiResponse.ok) {
          throw challengeApiResponse;
        }
        const challengeApiData: {
          challenge_id: string;
          challenge_b64url: string;
        } = await challengeApiResponse.json();
        ifDev(() =>
          console.log(`${__logId}: successfully retrieved challenge, solving @ ${Date.now()}`)
        );
        const solution = await solveSilentAuthChallenge(option, challengeApiData.challenge_b64url);
        ifDev(() =>
          console.log(`${__logId}: successfully solved challenge, logging in @ ${Date.now()}`)
        );
        const loginApiResponse = await progress.withNestedAsync('submitting challenge', () =>
          apiFetch(
            '/api/1/oauth/silent/login',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
              },
              body: JSON.stringify({
                challenge_id: challengeApiData.challenge_id,
                response_b64url: solution,
                refresh_token_desired: true,
              }),
            },
            null
          )
        );
        if (!loginApiResponse.ok) {
          throw loginApiResponse;
        }
        const loginApiData: {
          id_token: string;
          refresh_token?: string | null;
        } = await loginApiResponse.json();
        ifDev(() => console.log(`${__logId}: successfully finishing up @ ${Date.now()}`));
        const authTokens: TokenResponseConfig = {
          idToken: loginApiData.id_token,
          refreshToken: loginApiData.refresh_token ?? null,
        };
        const userAttributes = extractUserAttributes(authTokens);
        ifDev(() =>
          console.log(`${__logId}: successfully logged in via silent auth, storing tokens`)
        );
        await storeAuthTokens(authTokens);
        ifDev(() => console.log(`${__logId}: successfully stored tokens, storing user attributes`));
        await storeUserAttributes(userAttributes);
        return [authTokens, userAttributes];
      } catch (e) {
        ifDev(() => console.error(`${__logId}: error using silent auth signin`, e));
        try {
          await storeSilentAuthPreference({ type: 'never' });
        } catch (e2) {
          ifDev(() =>
            console.error(`${__logId}: error storing silent auth preference to never`, e2)
          );
        }
        return null;
      } finally {
        const oldValue = valueVWC.get();
        if (oldValue.state === 'loading' && oldValue.hint === 'silent-auth') {
          valueVWC.set({ state: 'loading', hint: undefined });
          valueVWC.callbacks.call(undefined);
        }
      }
    }

    async function refreshWithGlobalLockInner(
      refreshableTokens: TokenResponseConfig
    ): Promise<'retry' | 'done'> {
      ifDev(() =>
        console.log(
          `${__logId}: refreshWithGlobalLock starting; assuming we are holding the global lock`
        )
      );
      // since we have the global lock, active is irrelevant

      // token may no longer be refreshable due to the retry logic, though it's very unlikely
      // further, callers may depend on us checking this (better than sending a useless request
      // and may as well avoid duplicating the check)
      if (!isRefreshable(refreshableTokens, await getCurrentServerTimeMS())) {
        ifDev(() =>
          console.log(
            `${__logId}: tokens are not refreshable; clearing and switching to logged-out`
          )
        );
        try {
          ifDev(() => console.log(`${__logId}: trying to clear auth tokens`));
          await storeAuthTokens(null);
          ifDev(() => console.log(`${__logId}: successfully cleared auth tokens`));
        } catch (e) {
          ifDev(() => console.error(`${__logId}: error clearing auth tokens`, e));
        }
        try {
          ifDev(() => console.log(`${__logId}: trying to clear user attributes`));
          await storeUserAttributes(null);
          ifDev(() => console.log(`${__logId}: successfully cleared user attributes`));
        } catch (e) {
          ifDev(() => console.error(`${__logId}: error clearing user attributes`, e));
        }
        setVWC(valueVWC, { state: 'logged-out' }, () => false);
        return 'done';
      }

      // if our token is actually expired, immediately switch to a spinner. this is
      // only likely to happen if we've been suspended for a while, but that is a
      // fairly common case.
      if (valueVWC.get().state === 'logged-in') {
        const tokenExpiresAtServerMS = getJwtExpiration(refreshableTokens.idToken);
        const nowServerMS = await getCurrentServerTimeMS();
        if (tokenExpiresAtServerMS < nowServerMS) {
          ifDev(() =>
            console.log(
              `${__logId}: token is actually expired; switching to loading to get a spinner. not breaking out of refresh loop though.`
            )
          );
          setVWC(valueVWC, { state: 'loading', hint: undefined }, () => false);
        }
      }

      let newTokens: TokenResponseConfig;
      try {
        newTokens = await refreshTokens(refreshableTokens);
      } catch (e) {
        ifDev(() => console.log(`${__logId}: failed to refresh tokens`, e));

        if (!(e instanceof Response)) {
          ifDev(() =>
            console.log(
              `${__logId}: error was not a response; likely a network error. Retrying in 5-10 seconds`
            )
          );
          setVWC(valueVWC, { state: 'loading', hint: undefined }, (a, b) => a.state === b.state);
          await new Promise((r) => setTimeout(r, 5000 + Math.random() * 5000));
          return 'retry';
        }

        if (e.status === 429) {
          ifDev(() => console.log(`${__logId}: error was a 429, checking for Retry-After`));
          let retryAfterSeconds: number | null = null;
          try {
            const retryAfterStr = e.headers.get('Retry-After');
            if (retryAfterStr === null) {
              ifDev(() => console.log(`${__logId}: no retry-after header present`));
            } else {
              const retryAfterSecondsRaw = parseFloat(retryAfterStr);
              if (retryAfterSecondsRaw < 0) {
                ifDev(() => console.log(`${__logId}: retry-after header was negative`));
              } else if (retryAfterSecondsRaw > 300) {
                ifDev(() => console.log(`${__logId}: retry-after header was too large`));
              } else {
                retryAfterSeconds = retryAfterSecondsRaw;
                ifDev(() =>
                  console.log(`${__logId}: retry-after header was ${retryAfterSeconds} seconds`)
                );
              }
            }
          } catch (e) {
            ifDev(() => console.error(`${__logId}: retry-after header was malformed`, e));
          }
          const effectiveRetryAfter = retryAfterSeconds ?? 60;
          ifDev(() => console.log(`${__logId}: retrying in ${effectiveRetryAfter} seconds`));
          setVWC(valueVWC, { state: 'loading', hint: undefined }, (a, b) => a.state === b.state);
          await new Promise((r) => setTimeout(r, effectiveRetryAfter * 1000));
          return 'retry';
        }

        if (e.status >= 500) {
          ifDev(() =>
            console.log(
              `${__logId}: server error (${(e as Response).status}), retrying in 5-60 seconds`
            )
          );
          setVWC(valueVWC, { state: 'loading', hint: undefined }, (a, b) => a.state === b.state);
          await new Promise((r) => setTimeout(r, 5000 + Math.random() * 55000));
          return 'retry';
        }

        ifDev(() =>
          console.log(`${__logId}: non-retryable error; clearing and switching to logged-out`)
        );
        try {
          ifDev(() => console.log(`${__logId}: trying to clear auth tokens`));
          await storeAuthTokens(null);
          ifDev(() => console.log(`${__logId}: successfully cleared auth tokens`));
        } catch (e2) {
          ifDev(() => console.error(`${__logId}: error clearing auth tokens`, e2));
        }
        try {
          ifDev(() => console.log(`${__logId}: trying to clear user attributes`));
          await storeUserAttributes(null);
          ifDev(() => console.log(`${__logId}: successfully cleared user attributes`));
        } catch (e2) {
          ifDev(() => console.error(`${__logId}: error clearing user attributes`, e2));
        }
        setVWC(valueVWC, { state: 'logged-out' }, () => false);
        return 'done';
      }

      ifDev(() =>
        console.log(`${__logId}: successfully refreshed tokens; extracting user attributes`)
      );
      let userAttributes: UserAttributes;
      try {
        userAttributes = extractUserAttributes(newTokens);
      } catch (e) {
        ifDev(() => console.error(`${__logId}: error extracting user attributes`, e));
        ifDev(() =>
          console.log(
            `${__logId}: no way to recover and unlikely to fix without client update, storing tokens and ending loop`
          )
        );
        try {
          ifDev(() => console.log(`${__logId}: trying to store tokens`));
          await storeAuthTokens(newTokens);
          ifDev(() => console.log(`${__logId}: successfully stored tokens`));
        } catch (e2) {
          ifDev(() => console.error(`${__logId}: error storing tokens`, e2));
        }
        // end the loop
        throw new Error('unrecoverable error');
      }

      ifDev(() => console.log(`${__logId}: successfully extracted user attributes, storing..`));
      try {
        ifDev(() => console.log(`${__logId}: trying to store tokens`));
        await storeAuthTokens(newTokens);
        ifDev(() => console.log(`${__logId}: successfully stored tokens`));
      } catch (e) {
        ifDev(() => console.error(`${__logId}: error storing tokens`, e));
        throw new Error('unrecoverable error');
      }

      try {
        ifDev(() => console.log(`${__logId}: trying to store user attributes`));
        await storeUserAttributes(userAttributes);
        ifDev(() => console.log(`${__logId}: successfully stored user attributes`));
      } catch (e) {
        ifDev(() => console.error(`${__logId}: error storing user attributes`, e));
        throw new Error('unrecoverable error');
      }

      ifDev(() => console.log(`${__logId}: switching to logged-in`));
      setVWC(
        valueVWC,
        {
          state: 'logged-in',
          authTokens: newTokens,
          userAttributes,
        },
        () => false
      );
      return 'done';
    }

    async function refreshWithGlobalLock(refreshableTokens: TokenResponseConfig): Promise<void> {
      while (true) {
        const result = await refreshWithGlobalLockInner(refreshableTokens);
        if (result === 'done') {
          return;
        }
      }
    }
  }, [valueVWC, queueVWC]);

  return (
    <LoginContext.Provider
      value={useMemo(
        () => ({
          value: valueVWC,
          setAuthTokens,
          setUserAttributes,
          setSilentAuthPreference,
        }),
        [valueVWC, setAuthTokens, setUserAttributes, setSilentAuthPreference]
      )}>
      {children}
    </LoginContext.Provider>
  );
};
