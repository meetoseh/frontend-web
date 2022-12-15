import { createContext, PropsWithChildren, useCallback, useEffect, useState } from 'react';
import { Buffer } from 'buffer';

/**
 * The user attributes that are available when a user is logged in. When
 * changing user attributes we do so through cognito (via UpdateUserAttributes)
 * and then inform the backend via `POST /api/1/users/me/attributes`.
 */
export type UserAttributes = {
  /**
   * The user's email address
   */
  email: string;

  /**
   * If the users email address has been verified; generally this is true
   * by the time we get the user attributes.
   */
  emailVerified: boolean;

  /**
   * The users phone number, if available. Most users will not have a phone
   * number available directly from single sign on.
   */
  phoneNumber: string | null;

  /**
   * If the users phone number has been verified, if applicable. Expect
   * to see this false much of the time, since cognito might be mid-verification
   * (or they may not have completed verification)
   */
  phoneNumberVerified: boolean | null;

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

  /**
   * A URL where the users profile picture can be found. It is often
   * preferable to use the result from `GET /api/1/users/me/picture`
   * which will have more formats.
   */
  picture: string | null;
};

/**
 * The tokens that are retrieved from cognito after logging in.
 */
export type TokenResponseConfig = {
  /**
   * The id token - this is the primary bearer token for interacting with the
   * backend.
   */
  idToken: string;

  /**
   * The access token - this is largely unused.
   */
  accessToken: string | null;
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
 * In particular, whenever the backend calls for a "cognito JWT", it is referring
 * to the authTokens.idToken.
 *
 * Do NOT use the LoginContext.Provider directly. Instead use the exported
 * LoginProvider.
 */
export const LoginContext: React.Context<LoginContextValue> = createContext(defaultProps);

/**
 * The client ID of the Amazon Cognito client. This is generated by Amazon Cognito
 * after the user pool is created. We could provide it here via an environment variable,
 * but it's not sensitive information and there is no good way to pass that data to EAS
 * Build.
 *
 * We could create a different user pool client for our app, but there doesn't
 * appear to be any benefit from doing so.
 *
 * Note: This is the exported value "cognito-client-id" from the infrastructure project.
 *
 * https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-idp-settings.html
 * https://www.pulumi.com/registry/packages/aws/api-docs/cognito/userpoolclient/
 */
export const clientId = '6hp5dh14b2kofvme97ql9mojrq';

/**
 * The URL where the user pool is hosted. We went through the effort to ensure
 * this is a custom domain, but there is a default url that we could use instead
 * (a subdomain of amazoncognito.com).
 */
export const userPoolUrl = 'https://auth.oseh.io';

/**
 * The discovery document used by the expo auth service to communicate with the
 * user pool. This communicates the endpoints that should be used for the standard
 * oauth2 flows. Note that while this is sometimes available via a discovery
 * endpoint, there is often no benefit to doing so, except for a very minor
 * convenience.
 */
export const discoveryDocument = {
  authorizationEndpoint: userPoolUrl + '/oauth2/authorize',
  tokenEndpoint: userPoolUrl + '/oauth2/token',
  revocationEndpoint: userPoolUrl + '/oauth2/revoke',
};

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
    emailVerified: claims.email_verified || false,
    phoneNumber: claims.phone_number || null,
    phoneNumberVerified: claims['custom:pn_verified'] || false,
    name: nameClaims.name,
    givenName: nameClaims.given_name,
    familyName: nameClaims.family_name,
    picture: claims.picture || null,
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
    fetchTokens();
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

      await Promise.all([storeAuthTokens(null), storeUserAttributes(null)]);
      if (!active) {
        return;
      }
      setState('logged-out');
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

    function onExpired() {
      timeout = null;
      wrappedSetAuthTokens(null);
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
