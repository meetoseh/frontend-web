import { MutableRefObject, ReactElement, useCallback, useContext, useRef } from 'react';
import { ECPResources } from './ECPResources';
import styles from './ExtendedClassesPackPurchaseOffer.module.css';
import { LoginContext } from '../../../../../shared/contexts/LoginContext';
import assistiveStyles from '../../../../../shared/assistive.module.css';
import { useFullHeight } from '../../../../../shared/hooks/useFullHeight';
import { Button } from '../../../../../shared/forms/Button';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { OsehImageFromStateValueWithCallbacks } from '../../../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { useWindowSizeValueWithCallbacks } from '../../../../../shared/hooks/useWindowSize';
import { useMappedValueWithCallbacks } from '../../../../../shared/hooks/useMappedValueWithCallbacks';
import { ValueWithCallbacks } from '../../../../../shared/lib/Callbacks';

export const ExtendedClassesPackPurchaseOffer = ({
  resources,
  onRedirecting,
  onSkip,
}: {
  resources: ValueWithCallbacks<ECPResources>;
  onRedirecting: () => Promise<void>;
  onSkip: () => void;
}): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const buyURLPromise =
    useRef<Promise<string> | null>() as MutableRefObject<Promise<string> | null>;
  if (buyURLPromise.current === undefined) {
    buyURLPromise.current = null;
  }
  const containerRef = useRef<HTMLDivElement>(null);
  const backgroundOverlay = useRef<HTMLDivElement>(null);
  const windowSizeVWC = useWindowSizeValueWithCallbacks();

  useFullHeight({
    element: containerRef,
    attribute: 'minHeight',
    windowSizeVWC,
  });

  useFullHeight({
    element: backgroundOverlay,
    attribute: 'minHeight',
    windowSizeVWC,
  });

  const handleXClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onSkip();
    },
    [onSkip]
  );

  const loadBuyURL = useCallback<() => Promise<string>>(async () => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      throw new Error('User must be logged in to purchase');
    }
    const loginContext = loginContextUnch;

    const response = await apiFetch(
      '/api/1/campaigns/extended_classes_pack/purchase',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          cancel_path: '/',
          success_path: '/courses/activate',
        }),
      },
      loginContext
    );

    if (!response.ok) {
      throw response;
    }

    const json: { url: string } = await response.json();
    return json.url;
  }, [loginContextRaw]);

  const handleBuyNowClick = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();

      if (buyURLPromise.current === null) {
        buyURLPromise.current = loadBuyURL();
      }

      const redirectPromise = onRedirecting();
      const targetUrl = await buyURLPromise.current;

      try {
        await redirectPromise;
      } finally {
        window.location.href = targetUrl;
      }
    },
    [onRedirecting, loadBuyURL]
  );

  const handleBuyNowHover = useCallback(() => {
    if (buyURLPromise.current === null) {
      buyURLPromise.current = loadBuyURL();
    }
  }, [loadBuyURL]);

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.backgroundImageContainer}>
        <OsehImageFromStateValueWithCallbacks
          state={useMappedValueWithCallbacks(resources, (r) => r.journeyShared.blurredImage)}
        />
      </div>
      <div className={styles.backgroundOverlay} ref={backgroundOverlay} />
      <div className={styles.closeButtonContainer}>
        <div className={styles.closeButtonInnerContainer}>
          <button type="button" className={styles.close} onClick={handleXClick}>
            <div className={styles.closeIcon} />
            <div className={assistiveStyles.srOnly}>Close</div>
          </button>
        </div>
      </div>
      <div className={styles.innerContainer}>
        <div className={styles.content}>
          <div className={styles.banner}>
            <OsehImageFromStateValueWithCallbacks
              state={useMappedValueWithCallbacks(resources, (r) => r.shortPreview)}
            />
          </div>
          <div className={styles.title}>Extended Classes Pack</div>
          <div className={styles.description}>
            Become an early supporter and get more <em>three minute</em> classes.
          </div>
          <div className={styles.checkmarkList}>
            <div className={styles.checkmarkItem}>
              <div className={styles.checkmarkContainer}>
                <div className={styles.checkmark}></div>
              </div>
              <div className={styles.checkmarkText}>5 extended classes</div>
            </div>
            <div className={styles.checkmarkItem}>
              <div className={styles.checkmarkContainer}>
                <div className={styles.checkmark2}></div>
              </div>
              <div className={styles.checkmarkText}>Support Oseh</div>
            </div>
            <div className={styles.checkmarkItem}>
              <div className={styles.checkmarkContainer}>
                <div className={styles.checkmark3}></div>
              </div>
              <div className={styles.checkmarkText}>Lifetime Access</div>
            </div>
            <div className={styles.checkmarkItem}>
              <div className={styles.checkmarkContainer}>
                <div className={styles.checkmark4}></div>
              </div>
              <div className={styles.checkmarkText}>Limited time offer</div>
            </div>
          </div>
          <div className={styles.buyNowContainer}>
            <Button
              type="button"
              variant="filled-white"
              onClick={handleBuyNowClick}
              onMouseEnter={handleBuyNowHover}
              fullWidth>
              Buy Now
            </Button>
          </div>
          <div className={styles.buyNowDetailsContainer}>
            <div className={styles.buyNowDetails1}>Only $4.99, paid once.</div>
            <div className={styles.buyNowDetails2}>We will only show you this offer once</div>
          </div>
        </div>
      </div>
    </div>
  );
};
