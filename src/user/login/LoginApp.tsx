import { ReactElement, useCallback, useContext, useEffect, useRef } from 'react';
import '../../assets/fonts.css';
import styles from './LoginApp.module.css';
import assistiveStyles from '../../shared/assistive.module.css';
import { SplashScreen } from '../splash/SplashScreen';
import { HTTP_API_URL } from '../../shared/ApiConstants';
import { useWindowSizeValueWithCallbacks } from '../../shared/hooks/useWindowSize';
import { OsehImage } from '../../shared/images/OsehImage';
import { InterestsContext } from '../../shared/contexts/InterestsContext';
import { useOsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { setVWC } from '../../shared/lib/setVWC';
import { useErrorModal } from '../../shared/hooks/useErrorModal';
import { ModalContext } from '../../shared/contexts/ModalContext';
import { describeError } from '../../shared/forms/ErrorBlock';
import { Button } from '../../shared/forms/Button';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';
import { useReactManagedValueAsValueWithCallbacks } from '../../shared/hooks/useReactManagedValueAsValueWithCallbacks';
import { useUnwrappedValueWithCallbacks } from '../../shared/hooks/useUnwrappedValueWithCallbacks';

/**
 * Switches urls to go to the /dev_login page instead of the hosted ui
 */
const isDevelopment = process.env.REACT_APP_ENVIRONMENT === 'dev';

type LoginAppProps = {
  /**
   * The url to redirect to after login. Defaults to the current page. Note
   * that this is _not_ the initial url they are redirected back to for social
   * logins; we redirect client-side afterwords
   */
  redirectUrl?: string | undefined;
};

export type SocialUrls = { google: string; apple: string; direct: string };

/**
 * Gets the url for the given social login provider.
 */
export const getProviderUrl = async (provider: string): Promise<string> => {
  if (isDevelopment && provider !== 'Direct') {
    return '/dev_login';
  }

  const response = await fetch(HTTP_API_URL + '/api/1/oauth/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      provider: provider,
      refresh_token_desired: true,
    }),
  });

  if (!response.ok) {
    throw response;
  }

  const data = await response.json();
  return data.url;
};

/**
 * Gets the urls for each of the social login providers.
 *
 * Always returns null if load is set to false. If load is undefined or
 * true, it will return null until the urls are loaded.
 *
 * @param load True if the urls should be loaded, false if they should
 *   not be
 * @returns [urls, error] the urls for each of the social login providers,
 *   or null if they are not loaded yet. The error contains a react element
 *   that should be used to display that there was an error loading the urls
 *   and thus we can't let them signin right now, if such an error occurred,
 *   or null if there was no error.
 */
export const useProviderUrlsValueWithCallbacks = (
  load: ValueWithCallbacks<boolean>
): [ValueWithCallbacks<SocialUrls | null>, ValueWithCallbacks<ReactElement | null>] => {
  const urls = useWritableValueWithCallbacks<SocialUrls | null>(() => null);
  const error = useWritableValueWithCallbacks<ReactElement | null>(() => null);

  useValueWithCallbacksEffect(
    load,
    useCallback(
      (load) => {
        let running = true;
        getUrls();
        return () => {
          running = false;
        };

        async function getUrlsInner() {
          if (load === false) {
            setVWC(urls, null);
            return;
          }

          const [google, apple, direct] = await Promise.all([
            getProviderUrl('Google'),
            getProviderUrl('SignInWithApple'),
            getProviderUrl('Direct'),
          ]);

          if (!running) {
            return;
          }

          setVWC(urls, { google, apple, direct });
        }

        async function getUrls() {
          try {
            await getUrlsInner();
          } catch (e) {
            const err = await describeError(e);
            if (!running) {
              return;
            }
            console.warn('error loading sign-in urls:', e);
            setVWC(error, err);
          }
        }
      },
      [urls, error]
    )
  );

  return [urls, error];
};

/**
 * Gets the urls for each of the social login providers, in a hook-like
 * fashion. This is the primary business logic of the login app, and can
 * be used for custom login screens (like course activation) as well.
 *
 * Always returns null if load is set to false. If load is undefined or
 * true, it will return null until the urls are loaded.
 *
 * @deprecated prefer useProviderUrlsValueWithCallbacks
 */
export const useProviderUrls = (load?: boolean): SocialUrls | null => {
  const result = useProviderUrlsValueWithCallbacks(
    useReactManagedValueAsValueWithCallbacks(load ?? true)
  );

  return useUnwrappedValueWithCallbacks(result[0]);
};

/**
 * Configures the local storage item that is checked whenever the user lands
 * logged in to redirect them to the given url. If undefined, redirects the
 * user to the current page.
 */
export const useRedirectUrl = (redirectUrl: string | undefined) => {
  useEffect(() => {
    localStorage.setItem('login-redirect', redirectUrl ?? window.location.pathname);

    return () => {
      localStorage.removeItem('login-redirect');
    };
  }, [redirectUrl]);
};

/**
 * This allows users to sign up or sign in via social logins. It does not
 * use the login context; it will redirect back to the home page with the
 * required tokens in the url fragment on success.
 */
export const LoginApp = ({ redirectUrl = undefined }: LoginAppProps): ReactElement => {
  const interests = useContext(InterestsContext);
  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const componentRef = useRef<HTMLDivElement | null>(null);
  const error = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useEffect(() => {
    if (componentRef.current === null) {
      return;
    }
    const ele = componentRef.current;
    windowSizeVWC.callbacks.add(updateComponentStyle);
    updateComponentStyle();
    return () => {
      windowSizeVWC.callbacks.remove(updateComponentStyle);
    };

    function updateComponentStyle() {
      if (windowSizeVWC.get().height < 450) {
        ele.removeAttribute('style');
      } else {
        ele.style.height = `${windowSizeVWC.get().height}px`;
      }
    }
  }, [windowSizeVWC]);
  const urls = useProviderUrls();
  const imageHandler = useOsehImageStateRequestHandler({});
  useRedirectUrl(redirectUrl);

  const modalContext = useContext(ModalContext);
  useErrorModal(modalContext.modals, error, 'direct account login');

  if (urls === null) {
    return <SplashScreen />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <RenderGuardedComponent
          props={windowSizeVWC}
          component={(windowSize) => (
            <OsehImage
              uid={
                windowSize.width < 450
                  ? 'oseh_if_ds8R1NIo4ch3pD7vBRT2cg'
                  : 'oseh_if_hH68hcmVBYHanoivLMgstg'
              }
              jwt={null}
              displayWidth={windowSize.width}
              displayHeight={windowSize.height}
              alt=""
              isPublic={true}
              handler={imageHandler}
              placeholderColor={windowSize.width < 450 ? '#aaaaaa' : '#011419'}
            />
          )}
        />
      </div>
      <div className={styles.innerContainer}>
        <div className={styles.primaryContainer} ref={componentRef}>
          <div className={styles.logoAndInfoContainer}>
            <div className={styles.logoContainer}>
              <div className={styles.logo} />
              <div className={assistiveStyles.srOnly}>Oseh</div>
            </div>
            <div className={styles.info}>
              {(() => {
                const defaultCopy = <>A better day is 60 seconds away.</>;
                if (interests.state !== 'loaded') {
                  return defaultCopy;
                } else if (interests.primaryInterest === 'anxiety') {
                  return <>Sign up for instant, free access to anxiety-relieving meditations.</>;
                } else if (interests.primaryInterest === 'mindful') {
                  return (
                    <>
                      You&rsquo;re one step away from starting a life-changing mindfulness journey
                    </>
                  );
                } else if (interests.primaryInterest === 'sleep') {
                  return (
                    <>
                      Sign up for instant, free access to sleep-inducing meditations from the
                      world&rsquo;s most relaxing instructors.
                    </>
                  );
                } else {
                  return defaultCopy;
                }
              })()}
            </div>
          </div>
          <SocialSignins urls={urls} />
        </div>
      </div>
    </div>
  );
};

/**
 * Shows all the social signins in the standard way. Requires a dark
 * background, modal context, and an interests context
 */
export const SocialSignins = ({
  urls,
  noTests,
}: {
  urls: SocialUrls;
  /** This is not a standard login screen; login tests should not be presented */
  noTests?: boolean;
}): ReactElement => {
  const googleRef = useRef<HTMLDivElement>(null);
  const appleRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const google = googleRef.current;
    const apple = appleRef.current;
    const email = emailRef.current;

    if (google === null || apple === null || email === null) {
      return;
    }

    google.removeAttribute('style');
    apple.removeAttribute('style');
    email.removeAttribute('style');

    const googleWidth = google.offsetWidth;
    const appleWidth = apple.offsetWidth;
    const emailWidth = email.offsetWidth;

    const maxWidth = Math.max(googleWidth, appleWidth, emailWidth);

    google.style.paddingRight = `${maxWidth - googleWidth}px`;
    apple.style.paddingRight = `${maxWidth - appleWidth}px`;
    email.style.paddingRight = `${maxWidth - emailWidth}px`;
  }, []);

  return (
    <div className={styles.signinsContainer}>
      <Button type="button" variant="filled-white" onClick={urls.google}>
        <div className={styles.iconAndText}>
          <div className={styles.signInWithGoogleIcon}></div>
          <div ref={googleRef}>Sign in with Google</div>
        </div>
      </Button>
      <Button type="button" variant="filled-white" onClick={urls.apple}>
        <div className={styles.iconAndText}>
          <div className={styles.signInWithAppleIcon}></div>
          <div ref={appleRef}>Sign in with Apple</div>
        </div>
      </Button>
      <Button type="button" variant="filled-white" onClick={urls.direct}>
        <div className={styles.iconAndText}>
          <div className={styles.signInWithEmailIcon}></div>
          <div ref={emailRef}>Sign in with Email</div>
        </div>
      </Button>
    </div>
  );
};
