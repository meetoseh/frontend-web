import { ReactElement, useContext, useEffect, useState } from 'react';
import { LoginContext, LoginProvider } from '../shared/LoginContext';
import { ModalProvider } from '../shared/ModalContext';
import { LoginApp } from './login/LoginApp';
import { SplashScreen } from './splash/SplashScreen';
import '../assets/fonts.css';
import styles from './UserApp.module.css';
import { apiFetch } from '../shared/ApiConstants';
import { useFonts } from '../shared/lib/useFonts';
import { FullscreenContext, FullscreenProvider } from '../shared/FullscreenContext';
import { useOnboardingState } from './onboarding/hooks/useOnboardingState';
import { OnboardingRouter } from './onboarding/OnboardingRouter';
import { InterestsAutoProvider } from '../shared/InterestsContext';
import { useTimedValue } from '../shared/hooks/useTimedValue';

export default function UserApp(): ReactElement {
  return (
    <LoginProvider>
      <InterestsAutoProvider>
        <ModalProvider>
          <FullscreenProvider>
            <UserAppInner />
          </FullscreenProvider>
        </ModalProvider>
      </InterestsAutoProvider>
    </LoginProvider>
  );
}

const requiredFonts = [
  '300 1em Open Sans',
  '400 1em Open Sans',
  'italic 400 1em Open Sans',
  '600 1em Open Sans',
  '700 1em Open Sans',
];

/**
 * Originally, this would select what to do and pass functions around to
 * change the state. Now, this is essentially a thin wrapper around the
 * OnboardingRouter to add loading fonts, injecting a login screen, requesting
 * fullscreen, and showing a splash screen while loading
 */
const UserAppInner = (): ReactElement => {
  const loginContext = useContext(LoginContext);
  const fullscreenContext = useContext(FullscreenContext);
  const [state, setState] = useState<'loading' | 'onboarding' | 'login'>('loading');
  const fontsLoaded = useFonts(requiredFonts);
  const onboarding = useOnboardingState();

  // Since on first load the user likely sees white anyway, it's better to leave
  // it white and then go straight to the content if we can do so rapidly, rather
  // than going white screen -> black screen (start of splash) -> content. Of course,
  // if loading takes a while, we'll show the splash screen.
  const flashWhiteInsteadOfSplash = useTimedValue(true, false, 250);

  const [beenLoaded, setBeenLoaded] = useState(false);
  const [handlingCheckout, setHandlingCheckout] = useState(true);

  useEffect(() => {
    let active = true;
    checkCheckoutSuccess();
    return () => {
      active = false;
    };

    async function checkCheckoutSuccess() {
      if (loginContext.state === 'logged-out') {
        setHandlingCheckout(false);
        return;
      }

      if (loginContext.state !== 'logged-in') {
        return;
      }

      const searchParams = new URLSearchParams(window.location.search);
      if (!searchParams.has('checkout_uid')) {
        setHandlingCheckout(false);
        return;
      }

      setHandlingCheckout(true);
      try {
        const uid = searchParams.get('checkout_uid');

        await apiFetch(
          '/api/1/users/me/checkout/stripe/finish',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              checkout_uid: uid,
            }),
            keepalive: true,
          },
          loginContext
        );

        const newParams = new URLSearchParams(window.location.search);
        newParams.delete('checkout_uid');
        newParams.delete('checkout_success');
        window.history.replaceState(
          {},
          document.title,
          `${window.location.pathname}?${newParams.toString()}`
        );
      } finally {
        if (active) {
          setHandlingCheckout(false);
        }
      }
    }
  }, [loginContext]);

  useEffect(() => {
    if (loginContext.state === 'loading' || !fontsLoaded || handlingCheckout) {
      setState('loading');
      return;
    }

    if (loginContext.state === 'logged-out') {
      setState('login');
      return;
    }

    if (onboarding.loading) {
      setState('loading');
      return;
    }

    if (onboarding.required) {
      setState('onboarding');
      return;
    }

    console.warn("No state matched, defaulting to 'loading' (this should never happen)");
    setState('loading');
  }, [loginContext.state, fontsLoaded, handlingCheckout, onboarding.required, onboarding.loading]);

  useEffect(() => {
    if (loginContext.state !== 'logged-in') {
      return;
    }

    const uid = fullscreenContext.addFullscreenReason.bind(undefined)();

    return () => {
      fullscreenContext.removeFullscreenReason.bind(undefined)(uid);
    };
  }, [
    fullscreenContext.addFullscreenReason,
    fullscreenContext.removeFullscreenReason,
    loginContext.state,
  ]);

  useEffect(() => {
    if (state === 'onboarding' && !beenLoaded) {
      setBeenLoaded(true);
    }
  }, [state, beenLoaded]);

  return (
    <div className={styles.container}>
      {state === 'loading' && !flashWhiteInsteadOfSplash ? (
        <SplashScreen type={beenLoaded ? 'brandmark' : 'wordmark'} />
      ) : null}
      {state === 'login' ? <LoginApp /> : null}
      {onboarding.required ? (
        <div className={state !== 'onboarding' ? styles.displayNone : ''}>
          <OnboardingRouter state={onboarding} />
        </div>
      ) : null}
    </div>
  );
};
