import { ReactElement, useEffect, useState } from 'react';
import '../../assets/fonts.css';
import backgroundHuge from './assets/background-huge.jpg';
import backgroundMobile from './assets/background-mobile.jpg';
import backgroundDesktop from './assets/background-desktop.jpg';
import styles from './LoginApp.module.css';

/**
 * The domain of the auth service, e.g., auth.example.com
 */
const authDomain = process.env.REACT_APP_AUTH_DOMAIN!;

/**
 * The client id of the hosted ui, e.g., 1234567890abcdef1234567890abcdef
 */
const authClientId = process.env.REACT_APP_AUTH_CLIENT_ID!;

/**
 * This allows users to sign up or sign in via social logins. It does not
 * use the login context; it will redirect back to the home page with the
 * required tokens in the url fragment on success.
 *
 * This doesn't work in development mode since social sign in requires
 * cognito. Use /dev_login to sign in with a test user.
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
            <a
              className={styles.signInWithGoogle}
              href={`https://${authDomain}/oauth2/authorize?${new URLSearchParams({
                response_type: 'token',
                client_id: authClientId,
                redirect_uri: window.location.origin,
                identity_provider: 'Google',
              })}`}>
              <span className={styles.signInWithGoogleIcon}></span>
              <span className={styles.signInWithGoogleText}>Continue with Google</span>
            </a>
          </div>
          <div className={styles.signInWithAppleContainer}>
            <a
              className={styles.signInWithApple}
              href={`https://${authDomain}/oauth2/authorize?${new URLSearchParams({
                response_type: 'token',
                client_id: authClientId,
                redirect_uri: window.location.origin,
                identity_provider: 'SignInWithApple',
              })}`}>
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
