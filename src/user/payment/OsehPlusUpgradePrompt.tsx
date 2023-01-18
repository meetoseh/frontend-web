import { ReactElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import '../../assets/fonts.css';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { OsehImage } from '../../shared/OsehImage';
import styles from './OsehPlusUpgradePrompt.module.css';
import assistiveStyles from '../../shared/assistive.module.css';
import { LoginContext } from '../../shared/LoginContext';
import { SplashScreen } from '../splash/SplashScreen';
import { apiFetch } from '../../shared/ApiConstants';
import { describeErrorFromResponse, ErrorBlock } from '../../shared/forms/ErrorBlock';

type OsehPlusUpgradePromptProps = {
  /**
   * Used to indicate when required assets are ready. Provided true
   * when ready, false otherwise.
   */
  setLoaded: (loaded: boolean) => void;
};

/**
 * Provides the user the ability to upgrade to oseh plus if they don't
 * already have it.
 */
export const OsehPlusUpgradePrompt = ({ setLoaded }: OsehPlusUpgradePromptProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [loaded, setMyLoaded] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [havePro, setHavePro] = useState<boolean | null>(null);
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);
  const [error, setError] = useState<ReactElement | null>(null);
  const windowSize = useWindowSize();

  useEffect(() => {
    const loaded = !imageLoading && loginContext.state !== 'loading' && havePro !== null;
    setMyLoaded(loaded);
    setLoaded(loaded);
  }, [imageLoading, setLoaded, loginContext.state, havePro]);

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
        if (e instanceof TypeError) {
          setError(<>Could not connect to server. Check your internet connection.</>);
        } else if (e instanceof Response) {
          const error = await describeErrorFromResponse(e);
          if (!active) {
            return;
          }
          setError(error);
        } else {
          setError(<>Unknown error. Contact support.</>);
        }
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
      if (e instanceof TypeError) {
        setError(<>Could not connect to server. Check your internet connection.</>);
      } else if (e instanceof Response) {
        setError(await describeErrorFromResponse(e));
      } else {
        setError(<>Unknown error. Contact support.</>);
      }
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
      {!loaded ? <SplashScreen /> : null}
      <div className={styles.container} style={!loaded ? { display: 'none' } : {}}>
        <div className={styles.imageContainer}>
          <OsehImage
            uid="oseh_if_YpB7t4oDSpuOVgEu8O1ejQ"
            jwt={null}
            displayWidth={windowSize.width}
            displayHeight={windowSize.height}
            alt=""
            isPublic={true}
            setLoading={setImageLoading}
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
              <div className={styles.valueText}>Choose your own journey's</div>
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
            <div className={styles.price}>Only $2.49/mo, $29.99 billed annually</div>
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