import { ReactElement, useCallback, useEffect, useState } from 'react';
import '../../assets/fonts.css';
import backgroundHuge from './assets/background-huge.jpg';
import backgroundMobile from './assets/background-mobile.jpg';
import backgroundDesktop from './assets/background-desktop.jpg';
import styles from './LoginApp.module.css';
import { SplashScreen } from '../splash/SplashScreen';
import { HTTP_API_URL } from '../../shared/ApiConstants';

/**
 * Switches urls to go to the /dev_login page instead of the hosted ui
 */
const isDevelopment = process.env.REACT_APP_ENVIRONMENT === 'dev';

/**
 * This allows users to sign up or sign in via social logins. It does not
 * use the login context; it will redirect back to the home page with the
 * required tokens in the url fragment on success.
 *
 * This is an alternative to the hosted ui url which is used for more
 * styling at the cost of all non-social functionality.
 */
export const LoginApp = (): ReactElement => {
  const [imgVariant, setImageVariant] = useState<'none' | 'mobile' | 'desktop' | 'huge'>('none');

  useEffect(() => {
    const mobileQuery = matchMedia('(max-width: 767px)');
    const desktopQuery = matchMedia('(max-width: 1920px)');

    const listener = () =>
      setImageVariant(mobileQuery.matches ? 'mobile' : desktopQuery.matches ? 'desktop' : 'huge');

    listener();

    mobileQuery.addEventListener('change', listener);
    desktopQuery.addEventListener('change', listener);
    return () => {
      mobileQuery.removeEventListener('change', listener);
      desktopQuery.removeEventListener('change', listener);
    };
  }, []);

  const [img, imgWidth, imgHeight] = {
    none: [null, null, null],
    mobile: [backgroundMobile, 767, 1151],
    desktop: [backgroundDesktop, 1920, 1080],
    huge: [backgroundHuge, 4000, 6000],
  }[imgVariant];

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
        refresh_token_desired: false,
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

  if (googleUrl === null || appleUrl === null) {
    return <SplashScreen />;
  }

  return (
    <div className={styles.container}>
      {typeof img === 'string' ? (
        <div className={styles.imageContainer}>
          <img src={img} width={imgWidth!} height={imgHeight!} alt="" />
        </div>
      ) : null}
      <div className={styles.innerContainer}>
        <div className={styles.primaryContainer}>
          <div className={styles.title}>Sign in with your social account</div>
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
