import { ReactElement, useCallback, useContext, useEffect, useRef } from 'react';
import '../../assets/fonts.css';
import styles from './LoginApp.module.css';
import assistiveStyles from '../../shared/assistive.module.css';
import { SplashScreen } from '../splash/SplashScreen';
import { HTTP_API_URL, apiFetch } from '../../shared/ApiConstants';
import { useWindowSizeValueWithCallbacks } from '../../shared/hooks/useWindowSize';
import { OsehImage } from '../../shared/images/OsehImage';
import { InterestsContext } from '../../shared/contexts/InterestsContext';
import { useOsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import {
  ValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../shared/lib/Callbacks';
import { setVWC } from '../../shared/lib/setVWC';
import { useErrorModal } from '../../shared/hooks/useErrorModal';
import { ModalContext, addModalWithCallbackToRemove } from '../../shared/contexts/ModalContext';
import { describeError } from '../../shared/forms/ErrorBlock';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';
import { Button } from '../../shared/forms/Button';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';
import { TextInput } from '../../shared/forms/TextInput';
import { IconButton } from '../../shared/forms/IconButton';
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

export type SocialUrls = { google: string; apple: string };

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

          const [google, apple] = await Promise.all([
            getProviderUrl('Google'),
            getProviderUrl('SignInWithApple'),
          ]);

          if (!running) {
            return;
          }

          setVWC(urls, { google, apple });
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
  const interests = useContext(InterestsContext);
  const modalContext = useContext(ModalContext);
  const windowSizeVWC = useWindowSizeValueWithCallbacks();

  const screen = useWritableValueWithCallbacks<'home' | 'alt-select' | 'facebook' | 'email'>(
    () => 'home'
  );
  const email = useWritableValueWithCallbacks<string>(() => '');

  const storeAction = useCallback(
    (visitorUid: string, action: string, email?: string): Promise<Response> =>
      apiFetch(
        '/api/1/campaigns/login_test/store_action',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Visitor: visitorUid,
          },
          body: JSON.stringify({
            action,
            email,
          }),
          keepalive: true,
        },
        null
      ),
    []
  );

  const tryStoreAction = useCallback(
    (action: string, email?: string) => {
      if (
        interests.state === 'loading' ||
        interests.visitor.loading ||
        interests.visitor.uid === null
      ) {
        return;
      }

      return storeAction(interests.visitor.uid, action, email).catch(() => {});
    },
    [interests, storeAction]
  );

  useEffect(() => {
    tryStoreAction('home');
  }, [tryStoreAction]);

  const onContinueWithGoogleLinkClick = useCallback(() => {
    tryStoreAction('continue_with_google');
  }, [tryStoreAction]);

  const onContinueWithAppleLinkClick = useCallback(() => {
    tryStoreAction('continue_with_apple');
  }, [tryStoreAction]);

  const onContinueAnotherWay = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setVWC(screen, 'alt-select');
      tryStoreAction('continue_another_way');
    },
    [screen, tryStoreAction]
  );

  const onContinueWithFacebook = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setVWC(screen, 'facebook');
      tryStoreAction('continue_with_facebook');
    },
    [screen, tryStoreAction]
  );

  const onContinueWithEmail = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setVWC(screen, 'email');
      tryStoreAction('continue_with_email');
    },
    [screen, tryStoreAction]
  );

  const onBack = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setVWC(screen, 'home');
      tryStoreAction('home');
    },
    [screen, tryStoreAction]
  );

  useValueWithCallbacksEffect(screen, (curr) => {
    if (curr !== 'email' && curr !== 'facebook') {
      return undefined;
    }

    const saving = createWritableValueWithCallbacks(false);
    const success = createWritableValueWithCallbacks(false);
    const containerRef = createWritableValueWithCallbacks<HTMLDivElement | null>(null);
    const inputProps = createWritableValueWithCallbacks<{
      value: string;
      saving: boolean;
      done: boolean;
    }>({
      value: email.get(),
      saving: false,
      done: false,
    });

    email.callbacks.add(updateInputProps);
    saving.callbacks.add(updateInputProps);
    success.callbacks.add(updateInputProps);
    windowSizeVWC.callbacks.add(updateContainerStyle);
    containerRef.callbacks.add(updateContainerStyle);

    const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (success.get()) {
        setVWC(screen, 'home');
        tryStoreAction('home');
        return;
      }

      setVWC(saving, true);
      await Promise.all([
        tryStoreAction(curr === 'email' ? 'email_capture_email' : 'email_capture_fb', email.get()),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
      setVWC(success, true);
      setVWC(saving, false);
    };

    const modalCleanup = addModalWithCallbackToRemove(
      modalContext.modals,
      <div className={styles.signinModal} ref={(r) => setVWC(containerRef, r)}>
        <div className={styles.closeButtonContainer}>
          <div className={styles.closeButtonInnerContainer}>
            <IconButton icon={styles.closeIcon} srOnlyName="Close" onClick={onBack} />
          </div>
        </div>
        <div className={styles.signinModalInner}>
          <div className={styles.signinModalTitle}>
            Please leave your email and we&rsquo;ll let you know when login via{' '}
            {curr === 'email' ? 'email' : 'Facebook'} is available
          </div>

          <form className={styles.signinModalForm} onSubmit={onSubmit}>
            <RenderGuardedComponent
              props={inputProps}
              component={(props) => (
                <TextInput
                  label="Email Address"
                  value={props.value}
                  help="We will not share your email with anyone else"
                  disabled={props.saving || props.done}
                  inputStyle={props.done ? 'success-white' : 'white'}
                  onChange={(value) => setVWC(email, value)}
                  html5Validation={{ required: true }}
                />
              )}
            />

            <RenderGuardedComponent
              props={saving}
              component={(disabled) => (
                <Button
                  type="submit"
                  variant="filled-white"
                  fullWidth
                  disabled={disabled}
                  spinner={disabled}>
                  <RenderGuardedComponent
                    props={success}
                    component={(success) => (success ? <>Back</> : <>Submit</>)}
                  />
                </Button>
              )}
            />
          </form>
        </div>
      </div>
    );

    return () => {
      email.callbacks.remove(updateInputProps);
      windowSizeVWC.callbacks.remove(updateContainerStyle);
      modalCleanup();
    };

    function updateInputProps() {
      inputProps.set({ value: email.get(), saving: saving.get(), done: success.get() });
      inputProps.callbacks.call(undefined);
    }

    function updateContainerStyle() {
      const ele = containerRef.get();
      if (ele === null) {
        return;
      }

      ele.style.height = `${windowSizeVWC.get().height}px`;
    }
  });

  return (
    <div className={styles.signinsContainer}>
      <RenderGuardedComponent
        props={useMappedValueWithCallbacks(screen, (screen) => screen === 'home')}
        component={(isHome) =>
          isHome ? (
            <>
              <Button
                type="button"
                variant="filled-white"
                onClick={urls.google}
                onLinkClick={onContinueWithGoogleLinkClick}>
                <div className={styles.iconAndText}>
                  <span className={styles.signInWithGoogleIcon}></span>
                  <span>Continue with Google</span>
                </div>
              </Button>
              <Button
                type="button"
                variant="filled-white"
                onClick={urls.apple}
                onLinkClick={onContinueWithAppleLinkClick}>
                <div className={styles.iconAndText}>
                  <span className={styles.signInWithAppleIcon}></span>
                  <span>Continue with Apple</span>
                </div>
              </Button>
              {!noTests && (
                <div className={styles.signInWithOtherContainer}>
                  <Button
                    type="button"
                    variant="outlined-white"
                    fullWidth
                    onClick={onContinueAnotherWay}>
                    Continue another way
                  </Button>
                </div>
              )}
            </>
          ) : (
            <></>
          )
        }
      />
      <RenderGuardedComponent
        props={useMappedValueWithCallbacks(screen, (screen) => screen === 'alt-select')}
        component={(isAltSelect) =>
          isAltSelect ? (
            <>
              <Button type="button" variant="filled-white" onClick={onContinueWithFacebook}>
                <div className={styles.iconAndText}>
                  <span className={styles.signInWithFacebookIcon}></span>
                  <span>Continue with Facebook</span>
                </div>
              </Button>
              <Button type="button" variant="filled-white" onClick={onContinueWithEmail}>
                Continue with Email
              </Button>
              <Button type="button" variant="outlined-white" onClick={onBack}>
                Back
              </Button>
            </>
          ) : (
            <></>
          )
        }
      />
    </div>
  );
};
