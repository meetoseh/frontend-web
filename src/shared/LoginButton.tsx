import { useCallback, useContext, useEffect } from 'react';
import { LoginContext } from './contexts/LoginContext';

const LOGIN_URL = '/login';

/**
 * Creates a component which shows a login button (if the user is not logged in)
 * and a logout button otherwise. This expects to be within a login context.
 *
 * @returns The login/logout button
 */
export const LoginButton = (): React.ReactElement => {
  const loginContext = useContext(LoginContext);

  const logout = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      loginContext.setAuthTokens.apply(undefined, [null]);
    },
    [loginContext.setAuthTokens]
  );

  useEffect(() => {
    localStorage.setItem('login-redirect', window.location.pathname);
  }, []);

  return loginContext.state === 'logged-in' ? (
    <button onClick={logout}>Logout</button>
  ) : (
    <a href={LOGIN_URL}>Login</a>
  );
};
