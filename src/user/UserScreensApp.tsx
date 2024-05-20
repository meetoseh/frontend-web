import { ReactElement, useCallback, useContext, useEffect } from 'react';
import { LoginContext, LoginProvider } from '../shared/contexts/LoginContext';
import { SplashScreen } from './splash/SplashScreen';
import { apiFetch } from '../shared/ApiConstants';
import { useFonts } from '../shared/lib/useFonts';
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
import { ModalProvider } from '../shared/contexts/ModalContext';
import { useScreenQueueState } from './core/hooks/useScreenQueueState';
import { useScreenContext } from './core/hooks/useScreenContext';
import { useScreenQueue } from './core/hooks/useScreenQueue';
import { OsehScreen, ScreenResources } from './core/models/Screen';
import { useMappedValueWithCallbacks } from '../shared/hooks/useMappedValueWithCallbacks';
import { ConfirmationScreen } from './core/screens/confirmation/ConfirmationScreen';
import { USES_WEBP } from '../shared/images/usesWebp';
import { USES_SVG } from '../shared/images/usesSvg';
import { ImageInterstitialScreen } from './core/screens/image_interstitial/ImageInterstitialScreen';

export default function UserScreensApp(): ReactElement {
  const imageFormatsVWC = useWritableValueWithCallbacks<{
    usesWebp: boolean;
    usesSvg: boolean;
  } | null>(() => null);

  useEffect(() => {
    let active = true;
    check();
    return () => {
      active = false;
    };

    async function check() {
      const [usesWebp, usesSvg] = await Promise.all([USES_WEBP, USES_SVG]);
      if (!active) {
        return;
      }
      setVWC(imageFormatsVWC, { usesWebp, usesSvg });
    }
  });

  return (
    <LoginProvider>
      <InterestsAutoProvider>
        <ModalProvider>
          <RenderGuardedComponent
            props={imageFormatsVWC}
            component={(fmts) => (fmts === null ? <></> : <UserScreensAppInner {...fmts} />)}
          />
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

const screens = [ConfirmationScreen, ImageInterstitialScreen] as any[] as readonly OsehScreen<
  string,
  ScreenResources,
  object,
  { __mapped?: true }
>[];

/**
 * Initializes a screen queue and renders the current screen component or a spinner
 */
const UserScreensAppInner = ({
  usesWebp,
  usesSvg,
}: {
  usesWebp: boolean;
  usesSvg: boolean;
}): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const fontsLoaded = useFonts(requiredFonts);

  const screenQueueState = useScreenQueueState();
  const screenContext = useScreenContext(usesWebp, usesSvg);
  const screenQueue = useScreenQueue({
    screenQueueState,
    screenContext,
    screens,
    logging:
      process.env.REACT_APP_ENVIRONMENT === 'dev'
        ? {
            log: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error,
          }
        : {
            log: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
          },
  });

  const stateVWC = useWritableValueWithCallbacks<'loading' | 'error' | 'features'>(() => 'loading');
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

  const screenQueueTypeVWC = useMappedValueWithCallbacks(screenQueue.value, (v) => v.type);
  useValuesWithCallbacksEffect(
    [loginContextRaw.value, handlingCheckoutVWC, screenQueueTypeVWC],
    useCallback((): undefined => {
      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state === 'loading' || !fontsLoaded || handlingCheckoutVWC.get()) {
        setVWC(stateVWC, 'loading');
        return;
      }

      const sqType = screenQueueTypeVWC.get();
      if (sqType === 'spinner' || sqType === 'finishing-pop') {
        setVWC(stateVWC, 'loading');
        return;
      }

      if (sqType === 'error') {
        setVWC(stateVWC, 'error');
        return;
      }

      setVWC(beenLoadedVWC, true);
      setVWC(stateVWC, 'features');
    }, [
      loginContextRaw.value,
      fontsLoaded,
      handlingCheckoutVWC,
      screenQueueTypeVWC,
      beenLoadedVWC,
      stateVWC,
    ])
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
    <div>
      <RenderGuardedComponent
        props={stateVWC}
        component={(state) => {
          if (state === 'features') {
            return (
              <RenderGuardedComponent
                props={screenQueue.value}
                component={(sq) => sq.component ?? <></>}
              />
            );
          }

          if (state === 'error') {
            return (
              <RenderGuardedComponent
                props={screenQueue.value}
                component={(sq) => sq.error ?? <div>An error has occurred. Try refreshing.</div>}
              />
            );
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
