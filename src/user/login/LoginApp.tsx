import { ReactElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import { useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { setVWC } from '../../shared/lib/setVWC';
import { useErrorModal } from '../../shared/hooks/useErrorModal';
import { ModalContext } from '../../shared/contexts/ModalContext';
import { describeError } from '../../shared/forms/ErrorBlock';

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

export type SocialUrls = { google: string; apple: string };

/**
 * Gets the url for the given social login provider.
 */
export const getProviderUrl = async (provider: string): Promise<string | null> => {
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
 * Gets the urls for each of the social login providers, in a hook-like
 * fashion. This is the primary business logic of the login app, and can
 * be used for custom login screens (like course activation) as well.
 *
 * Always returns null if load is set to false. If load is undefined or
 * true, it will return null until the urls are loaded.
 */
export const useProviderUrls = (load?: boolean): SocialUrls | null => {
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);
  const [appleUrl, setAppleUrl] = useState<string | null>(null);

  const getProviderUrlWrapped = useCallback(
    async (provider: string): Promise<string | null> => {
      if (load === false) {
        return null;
      }

      return getProviderUrl(provider);
    },
    [load]
  );

  useEffect(() => {
    let active = true;
    getGoogleUrl();
    return () => {
      active = false;
    };

    async function getGoogleUrl() {
      const url = await getProviderUrlWrapped('Google');
      if (!active) {
        return;
      }

      setGoogleUrl(url);
    }
  }, [getProviderUrlWrapped]);

  useEffect(() => {
    let active = true;
    getAppleUrl();
    return () => {
      active = false;
    };

    async function getAppleUrl() {
      const url = await getProviderUrlWrapped('SignInWithApple');
      if (!active) {
        return;
      }

      setAppleUrl(url);
    }
  }, [getProviderUrlWrapped]);

  return useMemo(() => {
    if (googleUrl === null || appleUrl === null) {
      return null;
    }

    return { google: googleUrl, apple: appleUrl };
  }, [googleUrl, appleUrl]);
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
 *
 * This is an alternative to the hosted ui url which is used for more
 * styling at the cost of all non-social functionality.
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

  const numDirectAccClicks = useWritableValueWithCallbacks<number[]>(() => []);
  const handlingDirectAccClick = useRef(false);
  const handleDirectAccountClick = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (handlingDirectAccClick.current) {
        return;
      }

      handlingDirectAccClick.current = true;
      try {
        const clickAt = Date.now();
        const oldArr = numDirectAccClicks.get();
        const newArr = [...oldArr, clickAt];
        while (newArr[0] < clickAt - 5000) {
          newArr.shift();
        }
        setVWC(numDirectAccClicks, newArr);

        if (newArr.length < 3) {
          return;
        }

        const directAccountURL = await getProviderUrl('Direct');
        if (directAccountURL === null) {
          setVWC(error, <>Couldn't get direct account url</>);
          return;
        }

        window.location.href = directAccountURL;
      } catch (e) {
        setVWC(error, await describeError(e));
      } finally {
        handlingDirectAccClick.current = false;
      }
    },
    [numDirectAccClicks, error]
  );

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
            <button className={styles.directAccountSecretButton} onClick={handleDirectAccountClick}>
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
            </button>
          </div>
          <SocialSignins urls={urls} />
        </div>
      </div>
    </div>
  );
};

/**
 * Shows all the social signins in the standard way. Requires a dark
 * background.
 */
export const SocialSignins = ({ urls }: { urls: SocialUrls }): ReactElement => {
  return (
    <div className={styles.signinsContainer}>
      <div className={styles.signInWithGoogleContainer}>
        <a className={styles.signInWithGoogle} href={urls.google}>
          <span className={styles.signInWithGoogleIcon}></span>
          <span className={styles.signInWithGoogleText}>Continue with Google</span>
        </a>
      </div>
      <div className={styles.signInWithAppleContainer}>
        <a className={styles.signInWithApple} href={urls.apple}>
          <span className={styles.signInWithAppleIcon}></span>
          <span className={styles.signInWithAppleText}>Continue with Apple</span>
        </a>
      </div>
    </div>
  );
};
