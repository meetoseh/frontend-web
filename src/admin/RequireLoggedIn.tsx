import { PropsWithChildren, ReactElement, useContext, useEffect, useRef, useState } from 'react';
import { LoginContext } from '../shared/contexts/LoginContext';
import '../assets/fonts.css';
import styles from './RequireLoggedIn.module.css';
import { LoginButton } from '../shared/LoginButton';
import { useFullHeight } from '../shared/hooks/useFullHeight';
import { useWindowSizeValueWithCallbacks } from '../shared/hooks/useWindowSize';

/**
 * Redirects the user to the login page if they are not logged in. Requires
 * a login context. Only one of these components should be on the page
 */
export const RequireLoggedIn = ({ children }: PropsWithChildren<{}>): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [hiding, setHiding] = useState(loginContext.state === 'logged-out');
  const containerRef = useRef<HTMLDivElement>(null);
  const windowSizeVWC = useWindowSizeValueWithCallbacks();

  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSizeVWC });

  useEffect(() => {
    setHiding(loginContext.state === 'logged-out');
  }, [loginContext]);

  if (hiding) {
    return (
      <div className={styles.container} ref={containerRef}>
        <div className={styles.content}>
          <h1 className={styles.title}>You are not logged in</h1>
          <p className={styles.text}>Please log in to continue</p>
          <div className={styles.buttonContainer}>
            <LoginButton />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
