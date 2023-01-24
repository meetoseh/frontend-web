import { ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import { LoginContext, LoginProvider } from '../shared/LoginContext';
import { ModalProvider } from '../shared/ModalContext';
import { CurrentDailyEventLoader } from './daily_event/CurrentDailyEventLoader';
import { LoginApp } from './login/LoginApp';
import { SplashScreen } from './splash/SplashScreen';
import '../assets/fonts.css';
import styles from './UserApp.module.css';
import { Journey } from './journey/Journey';
import { RequestNameForm } from './login/RequestNameForm';
import { apiFetch } from '../shared/ApiConstants';
import { JourneyStart } from './journey/JourneyStart';
import {
  useJourneyAndJourneyStartShared,
  JourneyRef,
} from './journey/JourneyAndJourneyStartShared';
import { useFonts } from '../shared/lib/useFonts';
import { JourneyPostScreen } from './journey/JourneyPostScreen';

export default function UserApp(): ReactElement {
  return (
    <LoginProvider>
      <ModalProvider>
        <UserAppInner />
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
  const [desiredState, setDesiredState] = useState<
    'current-daily-event' | 'journey' | 'start-journey' | 'post-journey'
  >('current-daily-event');
  const [needRequestName, setNeedRequestName] = useState(false);
  const [state, setState] = useState<
    | 'loading'
    | 'current-daily-event'
    | 'request-name'
    | 'login'
    | 'journey'
    | 'start-journey'
    | 'post-journey'
  >('loading');
  const fontsLoaded = useFonts(requiredFonts);
  const [flashWhiteInsteadOfSplash, setFlashWhiteInsteadOfLoading] = useState(true);
  const [currentDailyEventLoaded, setCurrentDailyEventLoaded] = useState(false);
  const [journey, setJourney] = useState<JourneyRef | null>(null);
  const [journeyLoaded, setJourneyLoaded] = useState(false);
  const [startJourney, setStartJourney] = useState<((this: void) => void) | null>(null);
  const [requestNameLoaded, setRequestNameLoaded] = useState(false);
  const [handlingCheckout, setHandlingCheckout] = useState(true);
  const journeyAndJourneyStartShared = useJourneyAndJourneyStartShared(journey);

  const setStartJourneyWithFunc = useCallback((start: ((this: void) => void) | null) => {
    setStartJourney(() => start);
  }, []);

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

    if (desiredState === 'current-daily-event' && loginContext.state === 'logged-out') {
      setState('login');
      return;
    }

    if (desiredState === 'current-daily-event' && !currentDailyEventLoaded) {
      setState('loading');
      return;
    }

    if (['journey', 'start-journey'].indexOf(desiredState) >= 0 && !journeyLoaded) {
      setState('loading');
      return;
    }

    setState(desiredState);
  }, [
    loginContext.state,
    desiredState,
    currentDailyEventLoaded,
    fontsLoaded,
    journeyLoaded,
    needRequestName,
    requestNameLoaded,
    handlingCheckout,
  ]);

  const wrappedSetJourney = useCallback((journey: JourneyRef) => {
    setJourneyLoaded(false);
    setJourney(journey);
    setDesiredState('start-journey');
  }, []);

  const onJourneyFinished = useCallback(() => {
    setDesiredState('post-journey');
  }, []);

  const onJourneyPostFinished = useCallback(() => {
    setJourney(null);
    setDesiredState('current-daily-event');
  }, []);

  const onUserInitiatedStartJourney = useCallback(() => {
    startJourney!();
    setDesiredState('journey');
  }, [startJourney]);

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
      {desiredState === 'current-daily-event' && !handlingCheckout ? (
        <div className={state !== 'current-daily-event' ? styles.displayNone : ''}>
          <CurrentDailyEventLoader
            setLoaded={setCurrentDailyEventLoaded}
            setJourney={wrappedSetJourney}
          />
        </div>
      ) : null}
      {desiredState === 'start-journey' && journey !== null && startJourney !== null ? (
        <div className={state !== 'start-journey' ? styles.displayNone : ''}>
          <JourneyStart
            journey={journey}
            shared={journeyAndJourneyStartShared}
            onStart={onUserInitiatedStartJourney}
          />
        </div>
      ) : null}
      {['journey', 'start-journey'].indexOf(desiredState) >= 0 && journey !== null ? (
        <div className={state !== 'journey' ? styles.displayNone : ''}>
          <Journey
            setLoaded={setJourneyLoaded}
            shared={journeyAndJourneyStartShared}
            journey={journey}
            doStart={setStartJourneyWithFunc}
            onFinished={onJourneyFinished}
          />
        </div>
      ) : null}
      {desiredState === 'post-journey' && journey !== null ? (
        <div className={state !== 'post-journey' ? styles.displayNone : ''}>
          <JourneyPostScreen
            journey={journey}
            shared={journeyAndJourneyStartShared}
            onReturn={onJourneyPostFinished}
          />
        </div>
      ) : null}
    </div>
  );
};
