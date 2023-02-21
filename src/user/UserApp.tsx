import { ReactElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { LoginContext, LoginProvider } from '../shared/LoginContext';
import { ModalProvider } from '../shared/ModalContext';
import { CurrentDailyEventLoader } from './daily_event/CurrentDailyEventLoader';
import { LoginApp } from './login/LoginApp';
import { SplashScreen } from './splash/SplashScreen';
import '../assets/fonts.css';
import styles from './UserApp.module.css';
import { RequestNameForm } from './login/RequestNameForm';
import { apiFetch } from '../shared/ApiConstants';
import { JourneyRef, journeyRefKeyMap } from './journey/models/JourneyRef';
import { useFonts } from '../shared/lib/useFonts';
import { FullscreenContext, FullscreenProvider } from '../shared/FullscreenContext';
import { convertUsingKeymap } from '../admin/crud/CrudFetcher';
import { JourneyRouter } from './journey/JourneyRouter';
import { RequestPhoneForm } from './login/RequestPhoneForm';

export default function UserApp(): ReactElement {
  return (
    <LoginProvider>
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
  const [desiredState, setDesiredState] = useState<'current-daily-event' | 'onboard' | 'journey'>(
    'current-daily-event'
  );
  const [needRequestName, setNeedRequestName] = useState(false);
  const [needRequestPhone, setNeedRequestPhone] = useState(false);
  const [state, setState] = useState<
    'loading' | 'current-daily-event' | 'request-name' | 'request-phone' | 'login' | 'journey'
  >('loading');
  const fontsLoaded = useFonts(requiredFonts);
  const [flashWhiteInsteadOfSplash, setFlashWhiteInsteadOfLoading] = useState(true);
  const [currentDailyEventLoaded, setCurrentDailyEventLoaded] = useState(false);
  const [journey, setJourney] = useState<JourneyRef | null>(null);
  const [journeyIsOnboarding, setJourneyIsOnboarding] = useState(false);
  const [requestNameLoaded, setRequestNameLoaded] = useState(false);
  const [requestPhoneLoaded, setRequestPhoneLoaded] = useState(false);
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
    setNeedRequestName(
      loginContext.state === 'logged-in' && loginContext.userAttributes?.givenName === 'Anonymous'
    );
  }, [loginContext]);

  useEffect(() => {
    const skipped = localStorage.getItem('skip-request-phone') === '1';
    if (skipped) {
      setNeedRequestPhone(false);
      return;
    }

    setNeedRequestPhone(
      loginContext.state === 'logged-in' && loginContext.userAttributes?.phoneNumber === null
    );
  }, [loginContext]);

  const gettingOnboardingJourneyRef = useRef(false);
  useEffect(() => {
    if (gettingOnboardingJourneyRef.current) {
      return;
    }

    if (loginContext.state !== 'logged-in') {
      return;
    }

    if (desiredState !== 'current-daily-event' && desiredState !== 'onboard') {
      return;
    }

    const onboard = desiredState === 'onboard' || localStorage.getItem('onboard') === '1';
    if (!onboard) {
      return;
    }

    setDesiredState('onboard');
    getOnboardingJourney();
    return;

    async function getOnboardingJourney() {
      gettingOnboardingJourneyRef.current = true;
      try {
        const response = await apiFetch(
          '/api/1/users/me/start_introductory_journey',
          {
            method: 'POST',
          },
          loginContext
        );
        if (!response.ok) {
          throw response;
        }

        const data = await response.json();

        const journey = convertUsingKeymap(data, journeyRefKeyMap);
        setJourney(journey);
        setJourneyIsOnboarding(true);
        setDesiredState('journey');
      } catch (e) {
        if (!(e instanceof TypeError)) {
          console.error('Error getting onboarding journey, falling back to current daily event', e);
          localStorage.removeItem('onboard');
          setDesiredState('current-daily-event');
        } else {
          console.error(
            'Error getting onboarding journey; appears as TypeError, assuming page navigation'
          );
        }
      } finally {
        gettingOnboardingJourneyRef.current = false;
      }
    }
  }, [loginContext, desiredState]);

  useEffect(() => {
    if (loginContext.state === 'loading' || !fontsLoaded || handlingCheckout) {
      setState('loading');
      return;
    }

    if (needRequestName) {
      if (!requestNameLoaded) {
        setState('loading');
      } else {
        setState('request-name');
      }
      return;
    }

    if (needRequestPhone) {
      if (!requestPhoneLoaded) {
        setState('loading');
      } else {
        setState('request-phone');
      }
      return;
    }

    if (desiredState === 'current-daily-event' && loginContext.state === 'logged-out') {
      setState('login');
      return;
    }

    if (desiredState === 'current-daily-event' && !currentDailyEventLoaded) {
      setState('loading');
      return;
    }

    if (desiredState === 'onboard') {
      setState('loading');
      return;
    }

    setState(desiredState);
  }, [
    loginContext.state,
    desiredState,
    currentDailyEventLoaded,
    fontsLoaded,
    needRequestName,
    requestNameLoaded,
    handlingCheckout,
    needRequestPhone,
    requestPhoneLoaded,
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
    setJourneyIsOnboarding(false);
    setDesiredState('journey');
  }, []);

  const onJourneyPostFinished = useCallback(() => {
    localStorage.removeItem('onboard');
    setJourney(null);
    setJourneyIsOnboarding(false);
    setDesiredState('current-daily-event');
  }, []);

  const onRequestPhoneSkipped = useCallback(() => {
    localStorage.setItem('skip-request-phone', '1');
    setNeedRequestPhone(false);
  }, []);

  const onRequestPhoneFinished = useCallback(() => {
    setNeedRequestPhone(false);
  }, []);

  return (
    <div className={styles.container}>
      {state === 'loading' && !flashWhiteInsteadOfSplash ? (
        <SplashScreen type={desiredState === 'current-daily-event' ? 'wordmark' : 'brandmark'} />
      ) : null}
      {state === 'login' ? <LoginApp /> : null}
      {needRequestName ? (
        <div className={state !== 'request-name' ? styles.displayNone : ''}>
          <RequestNameForm setLoaded={setRequestNameLoaded} />
        </div>
      ) : null}
      {needRequestPhone ? (
        <div className={state !== 'request-phone' ? styles.displayNone : ''}>
          <RequestPhoneForm
            setLoaded={setRequestPhoneLoaded}
            onSkipped={onRequestPhoneSkipped}
            onFinished={onRequestPhoneFinished}
          />
        </div>
      ) : null}
      {desiredState === 'current-daily-event' && !handlingCheckout ? (
        <div className={state !== 'current-daily-event' ? styles.displayNone : ''}>
          <CurrentDailyEventLoader
            setLoaded={setCurrentDailyEventLoaded}
            setJourney={wrappedSetJourney}
          />
        </div>
      ) : null}
      {state === 'journey' && journey !== null ? (
        <JourneyRouter
          journey={journey}
          onFinished={onJourneyPostFinished}
          isOnboarding={journeyIsOnboarding}
        />
      ) : null}
    </div>
  );
};
