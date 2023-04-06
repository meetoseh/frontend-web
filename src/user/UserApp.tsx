import { ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import { LoginContext, LoginProvider } from '../shared/LoginContext';
import { ModalProvider } from '../shared/ModalContext';
import { CurrentDailyEventLoader } from './daily_event/CurrentDailyEventLoader';
import { LoginApp } from './login/LoginApp';
import { SplashScreen } from './splash/SplashScreen';
import '../assets/fonts.css';
import styles from './UserApp.module.css';
import { apiFetch } from '../shared/ApiConstants';
import { JourneyRef } from './journey/models/JourneyRef';
import { useFonts } from '../shared/lib/useFonts';
import { FullscreenContext, FullscreenProvider } from '../shared/FullscreenContext';
import { JourneyRouter } from './journey/JourneyRouter';
import { VisitorHandler } from '../shared/hooks/useVisitor';
import { useOnboardingState } from './onboarding/hooks/useOnboardingState';
import { OnboardingRouter } from './onboarding/OnboardingRouter';

export default function UserApp(): ReactElement {
  return (
    <LoginProvider>
      <VisitorHandler />
      <ModalProvider>
        <FullscreenProvider>
          <UserAppInner />
        </FullscreenProvider>
      </ModalProvider>
    </LoginProvider>
  );
}

const requiredFonts = [
  '300 1em Open Sans',
  '400 1em Open Sans',
  '600 1em Open Sans',
  '700 1em Open Sans',
];

const UserAppInner = (): ReactElement => {
  const loginContext = useContext(LoginContext);
  const fullscreenContext = useContext(FullscreenContext);
  const [desiredState, setDesiredState] = useState<'current-daily-event' | 'journey'>(
    'current-daily-event'
  );
  const [state, setState] = useState<
    'loading' | 'onboarding' | 'current-daily-event' | 'login' | 'journey'
  >('loading');
  const fontsLoaded = useFonts(requiredFonts);
  const onboarding = useOnboardingState();
  const [flashWhiteInsteadOfSplash, setFlashWhiteInsteadOfLoading] = useState(true);
  const [currentDailyEventLoaded, setCurrentDailyEventLoaded] = useState(false);
  const [journey, setJourney] = useState<JourneyRef | null>(null);
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
    let timeout: NodeJS.Timeout | null = setTimeout(() => {
      timeout = null;
      setFlashWhiteInsteadOfLoading(false);
    }, 250);

    return () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
    };
  });

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

    if (desiredState === 'current-daily-event' && !currentDailyEventLoaded) {
      setState('loading');
      return;
    }

    setState(desiredState);
  }, [
    loginContext.state,
    desiredState,
    currentDailyEventLoaded,
    fontsLoaded,
    handlingCheckout,
    onboarding.required,
    onboarding.loading,
  ]);

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

  const wrappedSetJourney = useCallback((journey: JourneyRef) => {
    setJourney(journey);
    setDesiredState('journey');
  }, []);

  const onJourneyPostFinished = useCallback(() => {
    localStorage.removeItem('onboard');
    setJourney(null);
    setDesiredState('current-daily-event');
  }, []);

  return (
    <div className={styles.container}>
      {state === 'loading' && !flashWhiteInsteadOfSplash ? (
        <SplashScreen type={desiredState === 'current-daily-event' ? 'wordmark' : 'brandmark'} />
      ) : null}
      {state === 'login' ? <LoginApp /> : null}
      {desiredState === 'current-daily-event' && !handlingCheckout && !onboarding.required ? (
        <div className={state !== 'current-daily-event' ? styles.displayNone : ''}>
          <CurrentDailyEventLoader
            setLoaded={setCurrentDailyEventLoaded}
            setJourney={wrappedSetJourney}
          />
        </div>
      ) : null}
      {state === 'journey' && journey !== null ? (
        <JourneyRouter journey={journey} onFinished={onJourneyPostFinished} isOnboarding={false} />
      ) : null}
      {onboarding.required ? (
        <div className={state !== 'onboarding' ? styles.displayNone : ''}>
          <OnboardingRouter state={onboarding} />
        </div>
      ) : null}
    </div>
  );
};
