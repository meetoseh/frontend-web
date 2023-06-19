import { ReactElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import '../../assets/fonts.css';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { OsehImage } from '../../shared/images/OsehImage';
import styles from './OsehPlusUpgradePrompt.module.css';
import assistiveStyles from '../../shared/assistive.module.css';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { SplashScreen } from '../splash/SplashScreen';
import { apiFetch } from '../../shared/ApiConstants';
import { describeError, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { useOsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';

/**
 * Provides the user the ability to upgrade to oseh plus if they don't
 * already have it.
 */
export const OsehPlusUpgradePrompt = (): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [havePro, setHavePro] = useState<boolean | null>(null);
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);
  const [error, setError] = useState<ReactElement | null>(null);
  const imageHandler = useOsehImageStateRequestHandler({});
  const windowSize = useWindowSize();

  useEffect(() => {
    if (loginContext.state === 'logged-out') {
      window.location.href = '/';
    }
  }, [loginContext.state]);

  useEffect(() => {
    let active = true;
    getHaveEntitlement();
    return () => {
      active = false;
    };

    async function getHaveEntitlement() {
      if (loginContext.state !== 'logged-in') {
        return;
      }

      try {
        let response = await apiFetch(
          '/api/1/users/me/entitlements/pro',
          {
            method: 'GET',
            headers: {
              Pragma: 'no-cache',
            },
          },
          loginContext
        );
        if (!active) {
          return;
        }

        if (response.status === 429) {
          response = await apiFetch(
            '/api/1/users/me/entitlements/pro',
            {
              method: 'GET',
            },
            loginContext
          );
          if (!active) {
            return;
          }
        }

        if (!response.ok) {
          throw response;
        }

        const data = await response.json();
        if (!active) {
          return;
        }

        setHavePro(data.is_active);
      } catch (e) {
        if (!active) {
          return;
        }

        console.error(e);
        const err = await describeError(e);
        if (!active) {
          return;
        }
        setError(err);
      }
    }
  }, [loginContext]);

  const urlPromise = useRef<Promise<string | null> | null>(null);
  const getUrl = useCallback(async () => {
    try {
      const response = await apiFetch(
        '/api/1/users/me/checkout/stripe/start',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            cancel_path: '/',
            success_path: '/',
          }),
        },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      const data = await response.json();
      return data.url;
    } catch (e) {
      console.error(e);
      const err = await describeError(e);
      setError(err);
      return null;
    }
  }, [loginContext]);

  const onButtonHover = useCallback(async () => {
    if (upgradeUrl !== null || havePro !== false) {
      return;
    }

    if (urlPromise.current === null) {
      urlPromise.current = getUrl();
    }

    setUpgradeUrl(await urlPromise.current);
  }, [upgradeUrl, havePro, getUrl]);

  const onClickBeforeLoaded = useCallback(async () => {
    if (havePro !== false) {
      window.location.href = '/';
      return;
    }

    if (upgradeUrl !== null) {
      window.location.href = upgradeUrl;
      return;
    }

    if (urlPromise.current === null) {
      urlPromise.current = getUrl();
    }

    const url = await urlPromise.current;
    if (url === null) {
      setError(<>Cannot upgrade at this time. Contact support.</>);
      return;
    }

    window.location.href = url;
  }, [upgradeUrl, getUrl, havePro]);

  return (
    <>
      {havePro === null ? <SplashScreen /> : null}
      <div className={styles.container} style={havePro === null ? { display: 'none' } : undefined}>
        <div className={styles.closeButtonContainer}>
          <div className={styles.closeButtonInnerContainer}>
            <a href="/" className={styles.close}>
              <div className={styles.closeIcon} />
              <div className={assistiveStyles.srOnly}>Close</div>
            </a>
          </div>
        </div>

        <div className={styles.imageContainer}>
          <OsehImage
            uid="oseh_if_hH68hcmVBYHanoivLMgstg"
            jwt={null}
            displayWidth={windowSize.width}
            displayHeight={windowSize.height}
            alt=""
            isPublic={true}
            handler={imageHandler}
          />
        </div>

        <div className={styles.content}>
          <div className={styles.osehPlus}>
            <div className={styles.wordmark}></div>
            <div className={styles.plus}></div>
            <div className={assistiveStyles.srOnly}>Oseh Plus</div>
          </div>
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
          <div className={styles.bottom}>
            <div className={styles.price}>Only $3.33/mo, $39.99 billed annually</div>
            {error && <ErrorBlock>{error}</ErrorBlock>}
            <div className={styles.upgradeContainer}>
              {havePro ? (
                <a href="/" className={styles.upgrade}>
                  Go to Oseh+
                </a>
              ) : upgradeUrl === null ? (
                <button
                  type="button"
                  className={styles.upgrade}
                  onClick={onClickBeforeLoaded}
                  onMouseEnter={onButtonHover}>
                  Upgrade to Oseh+
                </button>
              ) : (
                <a href={upgradeUrl} className={styles.upgrade}>
                  Upgrade to Oseh+
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
