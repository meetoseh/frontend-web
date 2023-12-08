import { useCallback, useContext, useRef } from 'react';
import { LoginContext } from '../contexts/LoginContext';
import { useValueWithCallbacksEffect } from './useValueWithCallbacksEffect';

/**
 * Calls the given function if the user logs out, based on the login state
 * going from logged-in to logged-out
 */
export const useLogoutHandler = (handler: () => void) => {
  const loginContextRaw = useContext(LoginContext);

  const loginState = useRef(loginContextRaw.value.get().state);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback((loginContext) => {
      if (loginState.current !== loginContext.state && loginContext.state !== 'loading') {
        if (loginState.current === 'logged-in') {
          handlerRef.current();
        }
        loginState.current = loginContext.state;
      }
      return undefined;
    }, [])
  );
};
