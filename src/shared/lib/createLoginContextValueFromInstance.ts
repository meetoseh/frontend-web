import { LoginContextValue, LoginContextValueLoggedIn } from '../contexts/LoginContext';
import { Callbacks } from './Callbacks';

/**
 * Creates a simplified login context value from a single logged-in instance.
 * The returned setters all raise errors, and the value getter will return the
 * provided instance if it's unexpired and logged-out otherwise. It will not
 * call callbacks, to avoid the need for a cleanup function.
 *
 * This is generally used as an adapter for objects that accept LoginContextValue
 * but for which the caller wants to have more control.
 */
export const createLoginContextValueFromInstance = ({
  user,
  userTokenExpiresAtLocal,
}: {
  user: LoginContextValueLoggedIn;
  userTokenExpiresAtLocal: number;
}): LoginContextValue => ({
  value: {
    get: () => {
      if (userTokenExpiresAtLocal <= Date.now()) {
        return { state: 'logged-out' };
      }
      return user;
    },
    callbacks: new Callbacks(), // listing doesn't need real callbacks
  },
  setAuthTokens: () => {
    throw new Error(
      'createLoginContextValueFromInstance#listing#setAuthTokens: not safe to do that'
    );
  },
  setUserAttributes: () => {
    throw new Error(
      'createLoginContextValueFromInstance#listing#setUserAttributes: not safe to do that'
    );
  },
  setSilentAuthPreference: () => {
    throw new Error(
      'createLoginContextValueFromInstance#listing#setSilentAuthPreference: not safe to do that'
    );
  },
});
