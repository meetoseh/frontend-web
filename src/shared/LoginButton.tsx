import { useCallback, useContext, useEffect } from 'react';
import { LoginContext } from './contexts/LoginContext';
import { useMappedValueWithCallbacks } from './hooks/useMappedValueWithCallbacks';
import { RenderGuardedComponent } from './components/RenderGuardedComponent';
import { setLoginRedirect } from '../user/login/lib/LoginRedirectStore';

const LOGIN_URL = '/login';

/**
 * Creates a component which shows a login button (if the user is not logged in)
 * and a logout button otherwise. This expects to be within a login context.
 *
 * @returns The login/logout button
 */
export const LoginButton = (): React.ReactElement => {
  const loginContextRaw = useContext(LoginContext);

  const logout = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      loginContextRaw.setAuthTokens.apply(undefined, [null]);
    },
    [loginContextRaw.setAuthTokens]
  );

  useEffect(() => {
    const cleanedUrl = new URL(window.location.href);
    cleanedUrl.search = '';
    cleanedUrl.hash = '';
    setLoginRedirect({
      url: cleanedUrl.toString(),
      expiresAtMS: Date.now() + 1000 * 60 * 30,
    });
  }, []);

  const isLoggedIn = useMappedValueWithCallbacks(
    loginContextRaw.value,
    (c) => c.state === 'logged-in'
  );

  return (
    <RenderGuardedComponent
      props={isLoggedIn}
      component={(loggedIn) =>
        loggedIn ? <button onClick={logout}>Logout</button> : <a href={LOGIN_URL}>Login</a>
      }
    />
  );
};
