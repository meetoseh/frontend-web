import { PropsWithChildren, ReactElement, useContext, useRef } from 'react';
import { LoginContext } from '../shared/contexts/LoginContext';
import '../assets/fonts.css';
import styles from './RequireLoggedIn.module.css';
import { LoginButton } from '../shared/LoginButton';
import { useFullHeight } from '../shared/hooks/useFullHeight';
import { useWindowSizeValueWithCallbacks } from '../shared/hooks/useWindowSize';
import { useMappedValueWithCallbacks } from '../shared/hooks/useMappedValueWithCallbacks';
import { RenderGuardedComponent } from '../shared/components/RenderGuardedComponent';

/**
 * Redirects the user to the login page if they are not logged in. Requires
 * a login context. Only one of these components should be on the page
 */
export const RequireLoggedIn = ({ children }: PropsWithChildren<{}>): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const hidingVWC = useMappedValueWithCallbacks(
    loginContextRaw.value,
    (s) => s.state === 'logged-out'
  );

  return (
    <RenderGuardedComponent
      props={hidingVWC}
      component={(hiding) => (
        <RequiredLogginInInner hiding={hiding}>{children}</RequiredLogginInInner>
      )}
    />
  );
};

const RequiredLogginInInner = ({
  hiding,
  children,
}: PropsWithChildren<{ hiding: boolean }>): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);
  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSizeVWC });

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
