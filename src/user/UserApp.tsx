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
import { RequestNotificationTimeForm } from './login/RequestNotificationTimeForm';
import { VisitorHandler } from '../shared/hooks/useVisitor';
import { dateToLocaleISODateString } from '../shared/lib/dateToLocaleISODateString';
import { DailyGoalPrompt } from './daily_goal/DailyGoalPrompt';

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
  const [desiredState, setDesiredState] = useState<'current-daily-event' | 'onboard' | 'journey'>(
    'current-daily-event'
  );
  const [needPromptDailyGoal, setNeedPromptDailyGoal] = useState(false);
  const [needRequestName, setNeedRequestName] = useState(false);
  const [needRequestPhone, setNeedRequestPhone] = useState(false);
  const [needRequestNotificationTime, setNeedRequestNotificationTime] = useState(false);
  const [state, setState] = useState<
    | 'loading'
    | 'current-daily-event'
    | 'request-daily-goal'
    | 'request-name'
    | 'request-phone'
    | 'request-notification-time'
    | 'login'
    | 'journey'
  >('loading');
  const fontsLoaded = useFonts(requiredFonts);
  const [flashWhiteInsteadOfSplash, setFlashWhiteInsteadOfLoading] = useState(true);
  const [currentDailyEventLoaded, setCurrentDailyEventLoaded] = useState(false);
  const [journey, setJourney] = useState<JourneyRef | null>(null);
  const [journeyIsOnboarding, setJourneyIsOnboarding] = useState(false);
  const [requestNameLoaded, setRequestNameLoaded] = useState(false);
  const [requestPhoneLoaded, setRequestPhoneLoaded] = useState(false);
  const [requestDailyGoalLoaded, setRequestDailyGoalLoaded] = useState(false);
  const [requestNotificationTimeLoaded, setRequestNotificationTimeLoaded] = useState(false);
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
    let lastPromptRaw = localStorage.getItem('last-prompt-daily-goal');
    if (lastPromptRaw === null) {
      setNeedPromptDailyGoal(true);
      return;
    }

    const lastPrompt: { sub: string; at: number; response: string | null } =
      JSON.parse(lastPromptRaw);
    if (lastPrompt.sub !== loginContext.userAttributes?.sub) {
      setNeedPromptDailyGoal(true);
      return;
    }

    const currentDate = dateToLocaleISODateString(new Date());
    const lastPromptDate = dateToLocaleISODateString(new Date(lastPrompt.at));

    if (currentDate !== lastPromptDate) {
      setNeedPromptDailyGoal(true);
      return;
    }

    setNeedPromptDailyGoal(false);
  }, [loginContext]);

  useEffect(() => {
    setNeedRequestName(
      loginContext.state === 'logged-in' && loginContext.userAttributes?.givenName === 'Anonymous'
    );
  }, [loginContext]);

  useEffect(() => {
    if (needRequestPhone || loginContext.userAttributes === null) {
      return;
    }

    const skipped = localStorage.getItem('skip-request-phone') === loginContext.userAttributes.sub;
    if (skipped) {
      setNeedRequestPhone(false);
      return;
    }

    setNeedRequestPhone(
      loginContext.state === 'logged-in' && loginContext.userAttributes?.phoneNumber === null
    );
  }, [loginContext, needRequestPhone]);

  useEffect(() => {
    if (needRequestNotificationTime || loginContext.userAttributes === null) {
      return;
    }

    const handled =
      localStorage.getItem('handled-request-notification-time') === loginContext.userAttributes.sub;
    if (handled) {
      setNeedRequestNotificationTime(false);
      return;
    }

    if (loginContext.state !== 'logged-in') {
      return;
    }

    let active = true;
    fetchNeedRequestNotificationTime();
    return () => {
      active = false;
    };

    async function fetchNeedRequestNotificationTime() {
      const response = await apiFetch(
        '/api/1/users/me/wants_notification_time_prompt',
        {
          method: 'GET',
        },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      const data = await response.json();
      if (active) {
        const needNotif = data.wants_notification_time_prompt;
        if (!needNotif) {
          localStorage.setItem(
            'handled-request-notification-time',
            loginContext.userAttributes!.sub
          );
        }
        setNeedRequestNotificationTime(needNotif);
      }
    }
  }, [loginContext, needRequestNotificationTime]);

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

    if (needPromptDailyGoal) {
      if (!requestDailyGoalLoaded) {
        setState('loading');
      } else {
        setState('request-daily-goal');
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

    if (needRequestNotificationTime) {
      if (!requestNotificationTimeLoaded) {
        setState('loading');
      } else {
        setState('request-notification-time');
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
    needRequestNotificationTime,
    requestNotificationTimeLoaded,
    needPromptDailyGoal,
    requestDailyGoalLoaded,
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
    if (loginContext.userAttributes) {
      localStorage.setItem('skip-request-phone', loginContext.userAttributes.sub);
    }
    setNeedRequestPhone(false);
  }, [loginContext.userAttributes]);

  const onRequestPhoneFinished = useCallback((receiveNotifs: boolean) => {
    if (receiveNotifs) {
      localStorage.removeItem('handled-request-notification-time');
      setNeedRequestNotificationTime(true);
    }

    setNeedRequestPhone(false);
  }, []);

  const onRequestNotificationTimeFinished = useCallback(() => {
    if (loginContext.userAttributes) {
      localStorage.setItem('handled-request-notification-time', loginContext.userAttributes.sub);
    }
    setNeedRequestNotificationTime(false);
  }, [loginContext.userAttributes]);

  const onDailyGoalPromptLoaded = useCallback(() => {
    setRequestDailyGoalLoaded(true);
  }, []);

  const onDailyGoalPromptFinished = useCallback(
    (response: string | null) => {
      const data: { sub: string; at: number; response: string | null } = {
        sub: loginContext.userAttributes?.sub || 'not-applicable',
        at: Date.now(),
        response,
      };

      localStorage.setItem('last-prompt-daily-goal', JSON.stringify(data));
      setNeedPromptDailyGoal(false);
    },
    [loginContext.userAttributes?.sub]
  );

  return (
    <div className={styles.container}>
      {state === 'loading' && !flashWhiteInsteadOfSplash ? (
        <SplashScreen type={desiredState === 'current-daily-event' ? 'wordmark' : 'brandmark'} />
      ) : null}
      {state === 'login' ? <LoginApp /> : null}
      {needPromptDailyGoal ? (
        <div className={state !== 'request-daily-goal' ? styles.displayNone : ''}>
          <DailyGoalPrompt
            onLoaded={onDailyGoalPromptLoaded}
            onFinished={onDailyGoalPromptFinished}
          />
        </div>
      ) : null}
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
      {needRequestNotificationTime ? (
        <div className={state !== 'request-notification-time' ? styles.displayNone : ''}>
          <RequestNotificationTimeForm
            showing={state === 'request-notification-time'}
            setLoaded={setRequestNotificationTimeLoaded}
            onDone={onRequestNotificationTimeFinished}
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
