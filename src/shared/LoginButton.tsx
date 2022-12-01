import { useCallback, useContext, useEffect } from 'react';
import { LoginContext } from './LoginContext';

const LOGIN_URL = process.env.REACT_APP_LOGIN_URL;

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

    return () => {
      localStorage.removeItem('login-redirect');
    };
  }, []);

  return loginContext.state === 'logged-in' ? (
    <button style={{ padding: '2px 8px' }} onClick={logout}>
      Logout
    </button>
  ) : (
    <a href={LOGIN_URL}>Login</a>
  );
};
