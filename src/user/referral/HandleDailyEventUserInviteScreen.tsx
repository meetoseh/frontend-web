import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { convertUsingKeymap } from '../../admin/crud/CrudFetcher';
import { apiFetch } from '../../shared/ApiConstants';
import { describeError, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { useFonts } from '../../shared/lib/useFonts';
import { LoginContext, LoginProvider } from '../../shared/LoginContext';
import { LoginApp } from '../login/LoginApp';
import { SplashScreen } from '../splash/SplashScreen';
import {
  RedeemedUserDailyEventInvite,
  keyMap as redeemedUserDailyEventInviteKeyMap,
} from './models/RedeemedUserDailyEventInvite';
import styles from './HandleDailyEventUserInviteScreen.module.css';
import { OsehImageFromState, useOsehImageState } from '../../shared/OsehImage';

/**
 * This screen will redirect to the home screen unless at the invite
 * path (/i/:code). Otherwise, it will have the user login (if they
 * are not logged in), then redeem the code, potentially showing
 * an explanation of what just happened.
 *
 * Once the code has been redeemed it will strip the code from the url
 * and redirect to the appropriate content for the link, storing the
 * received information in localStorage.
 */
export const HandleDailyEventUserInviteScreen = (): ReactElement => {
  const code: string | null = useMemo(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/i\/(.+)$/);
    if (!match) {
      window.location.href = '/';
      return null;
    }

    return match[1];
  }, []);

  return <LoginProvider>{code !== null ? <Inner code={code} /> : null}</LoginProvider>;
};

const requiredFonts = ['400 1em Open Sans', '600 1em Open Sans', '700 1em Open Sans'];

const Inner = ({ code }: { code: string }): ReactElement => {
  const loginContext = useContext(LoginContext);
  const fontsLoaded = useFonts(requiredFonts);
  const windowSize = useWindowSize();
  const [imageLoading, setImageLoading] = useState(true);
  const imageState = useOsehImageState({
    uid: 'oseh_if_-i-Qff8gqHyMZRb1r_5WMQ',
    jwt: null,
    displayWidth: windowSize.width,
    displayHeight: windowSize.height,
    alt: '',
    isPublic: true,
    setLoading: setImageLoading,
  });
  const [redeemed, setRedeemed] = useState<RedeemedUserDailyEventInvite | null>(null);
  const [error, setError] = useState<ReactElement | null>(null);

  const returnToHome = useCallback(() => {
    window.location.href = '/';
  }, []);

  useEffect(() => {
    let active = true;
    tryRedeem();
    return () => {
      active = false;
    };

    async function tryRedeem() {
      if (loginContext.state !== 'logged-in') {
        return;
      }

      try {
        const response = await apiFetch(
          '/api/1/referral/user_daily_event_invites/redeem',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              code,
            }),
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        const data = await response.json();
        const parsed = convertUsingKeymap(data, redeemedUserDailyEventInviteKeyMap);
        setRedeemed(parsed);
        setError(null);
      } catch (e) {
        if (!active) {
          return;
        }
        setRedeemed(null);
        console.error(e);
        const err = await describeError(e);
        if (!active) {
          return;
        }
        setError(err);
      }
    }
  }, [loginContext, code]);

  useEffect(() => {
    if (redeemed === null) {
      return;
    }
    const serialized = JSON.stringify(redeemed);
    localStorage.setItem('redeemedUserDailyEventInvite', serialized);

    if (!redeemed.receivedOsehPlus) {
      returnToHome();
      return;
    }
  }, [redeemed, returnToHome]);

  if (error !== null) {
    return <ErrorBlock>{error}</ErrorBlock>;
  }
  if (!fontsLoaded || loginContext.state === 'loading' || imageLoading) {
    return <SplashScreen type="wordmark" />;
  }
  if (loginContext.state === 'logged-out') {
    return <LoginApp />;
  }
  if (redeemed === null) {
    return <SplashScreen type="wordmark" />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromState {...imageState} />
      </div>
      <div className={styles.innerContainer}>
        {error !== null ? <ErrorBlock>{error}</ErrorBlock> : null}
        <div className={styles.primaryContainer}>
          <div className={styles.thankSender}>
            Don&rsquo;t forget to thank {redeemed.senderName} for your free class.
          </div>
          <div className={styles.osehPlus}>For the next 24 hours you will have access to Oseh+</div>
          <div className={styles.valueProps}>
            <div className={styles.valueProp}>
              <div className={styles.check}></div>
              <div className={styles.valueText}>Choose your own journey&rsquo;s</div>
            </div>
            <div className={styles.valueProp}>
              <div className={styles.check}></div>
              <div className={styles.valueText}>Invite friends to any class for free</div>
            </div>
            <div className={styles.valueProp}>
              <div className={styles.check}></div>
              <div className={styles.valueText}>Unlock more classes each day</div>
            </div>
            <div className={styles.valueProp}>
              <div className={styles.check}></div>
              <div className={styles.valueText}>Early access to new content</div>
            </div>
            <div className={styles.valueProp}>
              <div className={styles.check}></div>
              <div className={styles.valueText}>Cancel anytime</div>
            </div>
          </div>
          <div className={styles.buttonContainer}>
            <a className={styles.button} href="/">
              Let&rsquo;s Go
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
