import { ReactElement, useContext, useEffect, useMemo } from 'react';
import { LoginContext, LoginProvider } from '../shared/contexts/LoginContext';
import { ModalProvider } from '../shared/contexts/ModalContext';
import { LoginApp } from './login/LoginApp';
import { SplashScreen } from './splash/SplashScreen';
import '../assets/fonts.css';
import styles from './UserApp.module.css';
import { apiFetch } from '../shared/ApiConstants';
import { useFonts } from '../shared/lib/useFonts';
import { useFeaturesState } from './core/hooks/useFeaturesState';
import { InterestsAutoProvider } from '../shared/contexts/InterestsContext';
import { useTimedValueWithCallbacks } from '../shared/hooks/useTimedValue';
import { RenderGuardedComponent } from '../shared/components/RenderGuardedComponent';
import { useWritableValueWithCallbacks } from '../shared/lib/Callbacks';
import { setVWC } from '../shared/lib/setVWC';
import { useMappedValuesWithCallbacks } from '../shared/hooks/useMappedValuesWithCallbacks';
import { getUTMFromURL } from '../shared/hooks/useVisitor';
import { IsaiahCourseLoginScreen } from './core/features/isaiahCourse/IsaiahCourseLoginScreen';
import { useValuesWithCallbacksEffect } from '../shared/hooks/useValuesWithCallbacksEffect';

export default function UserApp(): ReactElement {
  return (
    <LoginProvider>
      <InterestsAutoProvider>
        <ModalProvider>
          <UserAppInner />
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
 * FeaturesRouter to add loading fonts, injecting a login screen, requesting
 * fullscreen, and showing a splash screen while loading
 */
const UserAppInner = (): ReactElement => {
  const loginContext = useContext(LoginContext);
  const fontsLoaded = useFonts(requiredFonts);
  const features = useFeaturesState();
  const utm = useMemo(() => getUTMFromURL(), []);

  const stateVWC = useWritableValueWithCallbacks<'loading' | 'features' | 'login'>(() => 'loading');
  // Since on first load the user likely sees white anyway, it's better to leave
  // it white and then go straight to the content if we can do so rapidly, rather
  // than going white screen -> black screen (start of splash) -> content. Of course,
  // if loading takes a while, we'll show the splash screen.
  const flashWhiteInsteadOfSplashVWC = useTimedValueWithCallbacks(true, false, 250);
  const beenLoadedVWC = useWritableValueWithCallbacks<boolean>(() => false);
  const handlingCheckoutVWC = useWritableValueWithCallbacks<boolean>(() => true);

  useEffect(() => {
    let active = true;
    checkCheckoutSuccess();
    return () => {
      active = false;
    };

    async function checkCheckoutSuccess() {
      if (loginContext.state === 'logged-out') {
        setVWC(handlingCheckoutVWC, false);
        return;
      }

      if (loginContext.state !== 'logged-in') {
        return;
      }

      const searchParams = new URLSearchParams(window.location.search);
      if (!searchParams.has('checkout_uid')) {
        setVWC(handlingCheckoutVWC, false);
        return;
      }

      setVWC(handlingCheckoutVWC, true);
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
          setVWC(handlingCheckoutVWC, false);
        }
      }
    }
  }, [loginContext, handlingCheckoutVWC]);

  useValuesWithCallbacksEffect([handlingCheckoutVWC, features], (): undefined => {
    if (loginContext.state === 'loading' || !fontsLoaded || handlingCheckoutVWC.get()) {
      setVWC(stateVWC, 'loading');
      return;
    }

    if (loginContext.state === 'logged-out') {
      setVWC(stateVWC, 'login');
      return;
    }

    if (features.get() === undefined) {
      setVWC(stateVWC, 'loading');
      return;
    }

    setVWC(beenLoadedVWC, true);
    setVWC(stateVWC, 'features');
  });

  const splashTypeVWC = useMappedValuesWithCallbacks(
    [flashWhiteInsteadOfSplashVWC, beenLoadedVWC],
    (): 'white' | 'word' | 'brand' => {
      if (beenLoadedVWC.get()) {
        return 'brand';
      }
      if (flashWhiteInsteadOfSplashVWC.get()) {
        return 'white';
      }
      return 'word';
    }
  );

  return (
    <div className={styles.container}>
      <RenderGuardedComponent
        props={stateVWC}
        component={(state) => {
          if (state === 'login') {
            if (utm !== null && utm.campaign === 'course' && utm.content === 'affirmation-course') {
              return <IsaiahCourseLoginScreen />;
            }

            return <LoginApp />;
          }

          if (state === 'features') {
            return <RenderGuardedComponent props={features} component={(f) => f ?? <></>} />;
          }

          return (
            <RenderGuardedComponent
              props={splashTypeVWC}
              component={(splashType) => {
                if (splashType === 'brand') {
                  return <SplashScreen type="brandmark" />;
                }
                if (splashType === 'word') {
                  return <SplashScreen type="wordmark" />;
                }
                return <></>;
              }}
            />
          );
        }}
      />
    </div>
  );
};
