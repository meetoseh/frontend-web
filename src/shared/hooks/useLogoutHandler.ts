import { useContext, useRef } from 'react';
import { LoginContext } from '../LoginContext';

/**
 * Calls the given function if the user logs out, based on the login state
 * going from logged-in to logged-out
 */
export const useLogoutHandler = (handler: () => void) => {
  const loginContext = useContext(LoginContext);

  const loginState = useRef(loginContext.state);
  if (loginState.current !== loginContext.state && loginContext.state !== 'loading') {
    if (loginState.current === 'logged-in') {
      handler();
    }
    loginState.current = loginContext.state;
  }
};
