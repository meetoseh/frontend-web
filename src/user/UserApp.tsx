import { ReactElement, useContext, useEffect, useState } from 'react';
import { LoginContext, LoginProvider } from '../shared/LoginContext';
import { ModalProvider } from '../shared/ModalContext';
import { CurrentDailyEventLoader } from './daily_event/CurrentDailyEventLoader';
import { LoginApp } from './login/LoginApp';
import { SplashScreen } from './splash/SplashScreen';
import '../assets/fonts.css';
import styles from './UserApp.module.css';

export default function UserApp(): ReactElement {
  useEffect(() => {
    localStorage.setItem('login-redirect', window.location.pathname);

    return () => {
      localStorage.removeItem('login-redirect');
    };
  }, []);

  return (
    <LoginProvider>
      <ModalProvider>
        <UserAppInner />
      </ModalProvider>
    </LoginProvider>
  );
}

const requiredFonts = ['400 1em Open Sans', '600 1em Open Sans', '700 1em Open Sans'];

const UserAppInner = (): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [desiredState, setDesiredState] = useState<'current-daily-event'>('current-daily-event');
  const [state, setState] = useState<'loading' | 'current-daily-event' | 'login'>('loading');
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [flashWhiteInsteadOfSplash, setFlashWhiteInsteadOfLoading] = useState(true);
  const [currentDailyEventLoaded, setCurrentDailyEventLoaded] = useState(false);

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
    if (!document.fonts || !document.fonts.load) {
      setFontsLoaded(true);
      return;
    }

    let active = true;
    loadRequiredFonts();
    return () => {
      active = false;
    };

    async function loadRequiredFonts() {
      try {
        await Promise.all(requiredFonts.map((font) => document.fonts.load(font)));
      } catch (e) {
        console.error('error while loading required fonts', e);
      } finally {
        if (active) {
          setFontsLoaded(true);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (loginContext.state === 'loading' || !fontsLoaded) {
      setState('loading');
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

    setState(desiredState);
  }, [loginContext.state, desiredState, currentDailyEventLoaded, fontsLoaded]);

  return (
    <div className={styles.container}>
      {state === 'loading' && !flashWhiteInsteadOfSplash ? <SplashScreen /> : null}
      {state === 'login' ? <LoginApp /> : null}
      {desiredState === 'current-daily-event' ? (
        <div className={state !== 'current-daily-event' ? styles.displayNone : ''}>
          <CurrentDailyEventLoader setLoaded={setCurrentDailyEventLoaded} />
        </div>
      ) : null}
    </div>
  );
};
