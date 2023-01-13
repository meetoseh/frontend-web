import { createContext, PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react';
import { Buffer } from 'buffer';
import { apiFetch } from './ApiConstants';

/**
 * The user attributes that are available when a user is logged in. When
 * changing user attributes via the backend we may not necessarily regenerate
 * the jwt, hence the jwts values may be stale.
 */
export type UserAttributes = {
  /**
   * The user's email address
   */
  email: string;

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
 * The value provided by the login context.
 */
export type LoginContextValue = {
  /**
   * The current state for loading the auth tokens; if we are loading, this means
   * we're still checking the secure store. If we're logged-in, the authTokens
   * will be available, and if we're logged-out, the authTokens will be null.
   *
   * This is helpful for login buttons to be disabled until we're sure about
   * the login state.
   */
  state: 'loading' | 'logged-in' | 'logged-out';

  /**
   * The number of times we've logged out. This is sometimes useful as a key
   * for components, since, e.g., useAuthRequest requires the component be
   * completely recreated/remounted after logging out. This is incremented
   * when setAuthTokens is called with null.
   */
  logoutCounter: number;

  /**
   * If we're loading or logged-out, null. Otherwise, the auth tokens.
   * In particular, the idToken is used to authenticate with the backend.
   * Do NOT directly fetch claims from the id token which are mutable -
   * instead, you must prefer "userAttributes", which includes any updates
   * we've made to the user attributes since the last time we logged in.
   */
  authTokens: TokenResponseConfig | null;

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
   * The users attributes, available when authTokens is available. This
   * generally has correspondance with the idToken claims, however, when
   * we update the user attributes on the client we do not necessarily
   * refresh the token - instead we update and store these attributes until
   * we get a fresh token.
   */
  userAttributes: UserAttributes | null;

  /**
   * The function to call to set the user attributes to a new value.
   * Raises an error if not logged in.
   */
  setUserAttributes: (userAttributes: UserAttributes) => Promise<void>;
};

const defaultProps: LoginContextValue = {
  state: 'loading',
  logoutCounter: 0,
  authTokens: null,
  setAuthTokens: async () => {
    throw new Error('cannot be called while still loading');
  },
  userAttributes: null,
  setUserAttributes: async () => {
    throw new Error('cannot be called while not logged in');
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
  if (authTokens === null) {
    localStorage.removeItem('authTokens');
  }
  localStorage.setItem('authTokens', JSON.stringify(authTokens));
};

/**
 * Retrieves the auth tokens from the appropriate store, stored via storeAuthTokens
 *
 * @returns The auth tokens from the appropriate store
 */
const retrieveAuthTokens = async (): Promise<TokenResponseConfig | null> => {
  // We're async for consistency with the react-native app, but there is no async
  // storage interface available
  const authTokensJson = localStorage.getItem('authTokens');
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
  }

  localStorage.setItem('userAttributes', JSON.stringify(userAttributes));
};

/**
 * Retrieves the user attributes from the appropriate store, stored via storeUserAttributes
 *
 * @returns The user attributes from the appropriate store
 */
const retrieveUserAttributes = async (): Promise<UserAttributes | null> => {
  // We're async for consistency with the react-native app, but there is no async
  // storage interface available
  const userAttributesJson = localStorage.getItem('userAttributes');
  if (userAttributesJson === null) {
    return null;
  }

  return JSON.parse(userAttributesJson);
};

/**
 * Returns true if the given token is fresh, false if it is expired or about to
 * expire.
 *
 * @param token The token to check
 */
const isTokenFresh = (token: TokenResponseConfig): boolean => {
  const nowMs = Date.now();
  const minExpTime = nowMs + 1000 * 60 * 5;

  const claimsBase64 = token.idToken.split('.')[1];
  const claimsJson = Buffer.from(claimsBase64, 'base64').toString('utf8');
  const claims = JSON.parse(claimsJson);
  return claims.exp * 1000 > minExpTime;
};

const isRefreshable = (token: TokenResponseConfig): boolean => {
  if (token.refreshToken === null) {
    return false;
  }

  const nowMs = Date.now();
  const minIat = nowMs - 1000 * 60 * 10;
  const minExpTime = nowMs + 1000 * 60 * 5;
  const minOgExpTime = nowMs - 1000 * 60 * 60 * 24 * 60 + 1000 * 60 * 5;

  const refreshClaimsBase64 = token.refreshToken.split('.')[1];
  const refreshClaimsJson = Buffer.from(refreshClaimsBase64, 'base64').toString('utf8');
  const refreshClaims = JSON.parse(refreshClaimsJson);

  return (
    refreshClaims.exp * 1000 > minExpTime &&
    refreshClaims['oseh:og_exp'] * 1000 > minOgExpTime &&
    refreshClaims.iat * 1000 > minIat
  );
};

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
 * A provider for the LoginContext. This is responsible for loading the auth
 * tokens. The auth tokens will only be provided if they are reasonably fresh;
 * otherwise, this will provide the logged-out state.
 */
export const LoginProvider = ({
  children,
}: PropsWithChildren<LoginProviderProps>): React.ReactElement => {
  const [state, setState] = useState<'loading' | 'logged-in' | 'logged-out'>('loading');
  const [authTokens, setAuthTokens] = useState<TokenResponseConfig | null>(null);
  const [userAttributes, setUserAttributes] = useState<UserAttributes | null>(null);
  const [logoutCounter, setLogoutCounter] = useState(0);

  const tokenLock = useRef<Promise<void> | null>(null);

  const wrappedSetAuthTokens = useCallback(
    async (authTokens: TokenResponseConfig | null) => {
      if (state === 'loading') {
        throw new Error('cannot be called while still loading');
      }

      const loggedIn = authTokens !== null;

      if (loggedIn) {
        const extractedUserAttributes = extractUserAttributes(authTokens);
        await Promise.all([
          storeAuthTokens(authTokens),
          storeUserAttributes(extractedUserAttributes),
        ]);
        setAuthTokens(authTokens);
        setUserAttributes(extractedUserAttributes);
        setState('logged-in');
      } else {
        await Promise.all([storeAuthTokens(null), storeUserAttributes(null)]);
        setLogoutCounter((counter) => counter + 1);
        setAuthTokens(null);
        setUserAttributes(null);
        setState('logged-out');
      }
    },
    [state]
  );

  const wrappedSetUserAttributes = useCallback(
    async (userAttributes: UserAttributes | null) => {
      if (state !== 'logged-in') {
        throw new Error('cannot be called while not logged in');
      }

      await storeUserAttributes(userAttributes);
      setUserAttributes(userAttributes);
    },
    [state]
  );

  useEffect(() => {
    let active = true;
    acquireLockAndFetchTokens();
    return () => {
      active = false;
    };

    async function fetchTokens() {
      const [tokens, attributes] = await Promise.all([
        retrieveAuthTokens(),
        retrieveUserAttributes(),
      ]);
      if (!active) {
        return;
      }

      if (tokens === null) {
        setState('logged-out');
        return;
      }

      if (isTokenFresh(tokens)) {
        setAuthTokens(tokens);
        setUserAttributes(attributes);
        setState('logged-in');
        return;
      }

      if (isRefreshable(tokens)) {
        let newTokens: TokenResponseConfig | null = null;
        try {
          newTokens = await refreshTokens(tokens);
        } catch (e) {
          console.error('failed to refresh tokens', e);
        }

        if (newTokens !== null) {
          console.log('successfully refreshed authorization tokens');
          const userAttributes = extractUserAttributes(newTokens);
          await Promise.all([storeAuthTokens(newTokens), storeUserAttributes(userAttributes)]);

          if (active) {
            setAuthTokens(newTokens);
            setUserAttributes(userAttributes);
            setState('logged-in');
          }
          return;
        }
      }

      await Promise.all([storeAuthTokens(null), storeUserAttributes(null)]);
      if (!active) {
        return;
      }
      setState('logged-out');
    }

    async function acquireLockAndFetchTokens() {
      if (tokenLock.current !== null) {
        try {
          await tokenLock.current;
        } catch (e) {
          console.log('ignoring error from previous token fetch', e);
        }
      }

      if (!active) {
        return;
      }

      tokenLock.current = fetchTokens();
      try {
        await tokenLock.current;
      } catch (e) {
        console.log('error fetching tokens', e);
      } finally {
        if (!active) {
          return;
        }

        tokenLock.current = null;
      }
    }
  }, []);

  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    if (authTokens !== null) {
      const idenClaimsB64 = authTokens.idToken.split('.')[1];
      const idenClaimsJson = Buffer.from(idenClaimsB64, 'base64').toString('utf8');
      const idenClaims = JSON.parse(idenClaimsJson);
      const expMs = idenClaims.exp * 1000;
      const nowMs = Date.now();

      timeout = setTimeout(onExpired, expMs - nowMs);
    }
    return () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
    };

    async function onExpired() {
      timeout = null;

      if (authTokens !== null && isRefreshable(authTokens)) {
        const refreshed = await refreshTokens(authTokens);
        wrappedSetAuthTokens(refreshed);
      } else {
        wrappedSetAuthTokens(null);
      }
    }
  }, [authTokens, wrappedSetAuthTokens]);

  return (
    <LoginContext.Provider
      value={{
        state,
        logoutCounter,
        authTokens,
        setAuthTokens: wrappedSetAuthTokens,
        userAttributes,
        setUserAttributes: wrappedSetUserAttributes,
      }}>
      {children}
    </LoginContext.Provider>
  );
};
