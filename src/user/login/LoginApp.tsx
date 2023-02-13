import { ReactElement, useCallback, useEffect, useState } from 'react';
import '../../assets/fonts.css';
import styles from './LoginApp.module.css';
import { SplashScreen } from '../splash/SplashScreen';
import { HTTP_API_URL } from '../../shared/ApiConstants';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { OsehImage } from '../../shared/OsehImage';

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

/**
 * This allows users to sign up or sign in via social logins. It does not
 * use the login context; it will redirect back to the home page with the
 * required tokens in the url fragment on success.
 *
 * This is an alternative to the hosted ui url which is used for more
 * styling at the cost of all non-social functionality.
 */
export const LoginApp = ({ redirectUrl = undefined }: LoginAppProps): ReactElement => {
  const windowSize = useWindowSize();
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);
  const [appleUrl, setAppleUrl] = useState<string | null>(null);

  const getProviderUrl = useCallback(async (provider: string): Promise<string> => {
    if (isDevelopment) {
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
  }, []);

  useEffect(() => {
    let active = true;
    getGoogleUrl();
    return () => {
      active = false;
    };

    async function getGoogleUrl() {
      const url = await getProviderUrl('Google');
      if (!active) {
        return;
      }

      setGoogleUrl(url);
    }
  }, [getProviderUrl]);

  useEffect(() => {
    let active = true;
    getAppleUrl();
    return () => {
      active = false;
    };

    async function getAppleUrl() {
      const url = await getProviderUrl('SignInWithApple');
      if (!active) {
        return;
      }

      setAppleUrl(url);
    }
  }, [getProviderUrl]);

  useEffect(() => {
    localStorage.setItem('login-redirect', redirectUrl ?? window.location.pathname);

    return () => {
      localStorage.removeItem('login-redirect');
    };
  }, [redirectUrl]);

  if (googleUrl === null || appleUrl === null) {
    return <SplashScreen />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImage
          uid="oseh_if_hH68hcmVBYHanoivLMgstg"
          jwt={null}
          displayWidth={windowSize.width}
          displayHeight={windowSize.height}
          alt=""
          isPublic={true}
        />
      </div>
      <div className={styles.innerContainer}>
        <div className={styles.primaryContainer}>
          <div className={styles.title}>
            Sign in with
            <br />
            your social account
          </div>
          <div className={styles.signInWithGoogleContainer}>
            <a className={styles.signInWithGoogle} href={googleUrl}>
              <span className={styles.signInWithGoogleIcon}></span>
              <span className={styles.signInWithGoogleText}>Continue with Google</span>
            </a>
          </div>
          <div className={styles.signInWithAppleContainer}>
            <a className={styles.signInWithApple} href={appleUrl}>
              <span className={styles.signInWithAppleIcon}></span>
              <span className={styles.signInWithAppleText}>Continue with Apple</span>
            </a>
          </div>
        </div>
        <div className={styles.legalText}>
          We won't post to any of your accounts without asking first.
        </div>
      </div>
    </div>
  );
};
