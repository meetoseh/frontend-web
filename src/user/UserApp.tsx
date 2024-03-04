import { ReactElement, useCallback, useContext } from 'react';
import { LoginContext, LoginProvider } from '../shared/contexts/LoginContext';
import { ModalProvider } from '../shared/contexts/ModalContext';
import { SplashScreen } from './splash/SplashScreen';
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
import { useValuesWithCallbacksEffect } from '../shared/hooks/useValuesWithCallbacksEffect';
import { useValueWithCallbacksEffect } from '../shared/hooks/useValueWithCallbacksEffect';
import { usePurchaseSuccessfulModal } from './core/features/upgrade/hooks/usePurchaseSuccessfulModal';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';

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
 * Originally, this would select what to do and pass functions around to change
 * the state. Now, this is essentially a thin wrapper around the FeaturesRouter
 * to add loading fonts and showing a splash screen while loading
 */
const UserAppInner = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const fontsLoaded = useFonts(requiredFonts);
  const features = useFeaturesState();

  const stateVWC = useWritableValueWithCallbacks<'loading' | 'features'>(() => 'loading');
  // Since on first load the user likely sees white anyway, it's better to leave
  // it white and then go straight to the content if we can do so rapidly, rather
  // than going white screen -> black screen (start of splash) -> content. Of course,
  // if loading takes a while, we'll show the splash screen.
  const flashWhiteInsteadOfSplashVWC = useTimedValueWithCallbacks(true, false, 250);
  const beenLoadedVWC = useWritableValueWithCallbacks<boolean>(() => false);
  const handlingCheckoutVWC = useWritableValueWithCallbacks<boolean>(() => true);
  const showCheckoutSuccessfulUntilVWC = useWritableValueWithCallbacks<number | undefined>(
    () => undefined
  );

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        let active = true;
        checkCheckoutSuccess();
        return () => {
          active = false;
        };

        async function checkCheckoutSuccess() {
          if (loginContextUnch.state === 'logged-out') {
            setVWC(handlingCheckoutVWC, false);
            return;
          }

          if (loginContextUnch.state !== 'logged-in') {
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

            const response = await apiFetch(
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
              loginContextUnch
            );

            const newParams = new URLSearchParams(window.location.search);
            newParams.delete('checkout_uid');
            newParams.delete('checkout_success');
            window.history.replaceState(
              {},
              document.title,
              `${window.location.pathname}?${newParams.toString()}`
            );

            if (response.ok) {
              setVWC(showCheckoutSuccessfulUntilVWC, Date.now() + 15000);
            }
          } finally {
            if (active) {
              setVWC(handlingCheckoutVWC, false);
            }
          }
        }
      },
      [handlingCheckoutVWC, showCheckoutSuccessfulUntilVWC]
    )
  );

  useValuesWithCallbacksEffect(
    [loginContextRaw.value, handlingCheckoutVWC, features],
    useCallback((): undefined => {
      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state === 'loading' || !fontsLoaded || handlingCheckoutVWC.get()) {
        setVWC(stateVWC, 'loading');
        return;
      }

      if (features.get() === undefined) {
        setVWC(stateVWC, 'loading');
        return;
      }

      setVWC(beenLoadedVWC, true);
      setVWC(stateVWC, 'features');
    }, [loginContextRaw.value, fontsLoaded, handlingCheckoutVWC, features, beenLoadedVWC, stateVWC])
  );

  usePurchaseSuccessfulModal(
    adaptValueWithCallbacksAsVariableStrategyProps(showCheckoutSuccessfulUntilVWC)
  );

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
