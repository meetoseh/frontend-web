import { ReactElement } from 'react';
import { useScreenContext } from '../core/hooks/useScreenContext';
import { Login } from '../core/screens/login/Login';

/**
 * This allows users to sign up or sign in via social logins. It does not
 * use the login context; it will redirect back to the home page with the
 * required tokens in the url fragment on success.
 */
export const LoginApp = (): ReactElement => {
  const screenContext = useScreenContext(false, true);
  return <Login ctx={screenContext} />;
};
