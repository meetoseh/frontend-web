import { ReactElement, useCallback, useContext, useEffect } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { UpgradeResources } from './UpgradeResources';
import { UpgradeState } from './UpgradeState';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { OsehImageProps } from '../../../../shared/images/OsehImageProps';
import { useOsehImageStateValueWithCallbacks } from '../../../../shared/images/useOsehImageStateValueWithCallbacks';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import styles from './Upgrade.module.css';
import {
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { useValuesWithCallbacksEffect } from '../../../../shared/hooks/useValuesWithCallbacksEffect';
import { setVWC } from '../../../../shared/lib/setVWC';
import { OsehImageFromStateValueWithCallbacks } from '../../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { IconButton } from '../../../../shared/forms/IconButton';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { ErrorBlock, describeError } from '../../../../shared/forms/ErrorBlock';
import { combineClasses } from '../../../../shared/lib/combineClasses';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { RevenueCatPackage } from './models/RevenueCatPackage';
import { PurchasesStoreProduct } from './models/PurchasesStoreProduct';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { Button } from '../../../../shared/forms/Button';
import { useStartSession } from '../../../../shared/hooks/useInappNotificationSession';
import { RevenueCatPlatform } from './lib/RevenueCatPlatform';
import { ModalContext } from '../../../../shared/contexts/ModalContext';
import { useErrorModal } from '../../../../shared/hooks/useErrorModal';
import { apiFetch } from '../../../../shared/ApiConstants';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { InlineOsehSpinner } from '../../../../shared/components/InlineOsehSpinner';

/**
 * Allows the user to upgrade to Oseh+, if they are eligible to do so
 */
export const Upgrade = ({
  state,
  resources,
}: FeatureComponentProps<UpgradeState, UpgradeResources>): ReactElement => {
  const modalContext = useContext(ModalContext);
  const loginContextRaw = useContext(LoginContext);
  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const backgroundImageProps = useMappedValueWithCallbacks(
    windowSizeVWC,
    (size): OsehImageProps => ({
      uid: 'oseh_if_qWZHxhR86u_wttPwkoa1Yw',
      jwt: null,
      displayWidth: size.width,
      displayHeight: size.height - 410,
      alt: '',
      isPublic: true,
    })
  );
  const backgroundImageState = useOsehImageStateValueWithCallbacks(
    adaptValueWithCallbacksAsVariableStrategyProps(backgroundImageProps),
    resources.get().imageHandler
  );
  useStartSession(
    {
      type: 'callbacks',
      props: () => resources.get().session,
      callbacks: resources.callbacks,
    },
    {
      onStart: () => {
        const ctx = state.get().context;
        const res = resources.get();
        const offer = res.offer;
        const session = res.session;

        session?.storeAction('open', {
          context: {
            type: ctx?.type ?? 'generic',
            ...(ctx?.type === 'series'
              ? { series: ctx.course.uid }
              : ctx?.type === 'longerClasses'
              ? { emotion: ctx.emotion }
              : {}),
          },
          platform: RevenueCatPlatform,
          offering:
            offer.type !== 'success'
              ? null
              : {
                  id: offer.offering.identifier,
                  products: offer.offering.packages.map((p) => p.identifier),
                },
          initial: offer?.offering?.packages?.[0]?.identifier ?? null,
        });
      },
    }
  );

  const backgroundRefVWC = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  useValuesWithCallbacksEffect([windowSizeVWC, backgroundRefVWC], () => {
    const size = windowSizeVWC.get();
    const bknd = backgroundRefVWC.get();
    if (bknd !== null) {
      bknd.style.minHeight = `${size.height}px`;
    }
    return undefined;
  });

  const offerVWC = useMappedValueWithCallbacks(resources, (r) => r.offer.offering);
  const activePackageIdxVWC = useWritableValueWithCallbacks<number>(() => 0);

  useValueWithCallbacksEffect(offerVWC, (offer) => {
    const activePackageIdx = activePackageIdxVWC.get();
    if (offer === null || offer === undefined || offer.packages.length <= activePackageIdx) {
      setVWC(activePackageIdxVWC, 0);
    }
    return undefined;
  });

  const offersAndPricesVWC = useMappedValueWithCallbacks(
    resources,
    (r): [RevenueCatPackage, PurchasesStoreProduct][] => {
      const offer = r.offer.offering;
      const price = r.offerPrice;

      if (offer === null || price.type !== 'success') {
        return [];
      }

      return offer.packages.map((pkg) => {
        const pkgPrice = price.pricesByPlatformProductId[pkg.platformProductIdentifier];
        return [pkg, pkgPrice];
      });
    }
  );

  const activePriceVWC = useMappedValuesWithCallbacks(
    [offersAndPricesVWC, activePackageIdxVWC],
    (): PurchasesStoreProduct | undefined => {
      return (offersAndPricesVWC.get()[activePackageIdxVWC.get()] ?? [])[1];
    }
  );

  useEffect(() => {
    activePackageIdxVWC.callbacks.add(onSelectionChanged);
    return () => {
      activePackageIdxVWC.callbacks.remove(onSelectionChanged);
    };

    function onSelectionChanged() {
      const idx = activePackageIdxVWC.get();
      const offer = offerVWC.get();
      const pkg = offer?.packages[idx];
      if (pkg === undefined) {
        return;
      }

      resources.get().session?.storeAction('package_selected', { package: pkg.identifier });
    }
  }, [activePackageIdxVWC, offerVWC, resources]);

  const subscribeErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useErrorModal(modalContext.modals, subscribeErrorVWC, 'subscribing');

  const redirectingVWC = useWritableValueWithCallbacks<boolean>(() => false);
  const handleSubscribe = useCallback(async () => {
    const idx = activePackageIdxVWC.get();
    const offer = offerVWC.get();
    const pkg = offer?.packages[idx];
    if (pkg === undefined) {
      return;
    }

    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      return;
    }
    const loginContext = loginContextUnch;

    if (redirectingVWC.get()) {
      return;
    }
    setVWC(redirectingVWC, true);

    try {
      const res = resources.get();
      res.session?.storeAction('subscribe_clicked', { immediate: false });
      const response = await apiFetch(
        '/api/1/users/me/checkout/stripe/start',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            package_id: pkg.identifier,
            cancel_path: '/upgrade',
            success_path: '/',
          }),
        },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      const data: { url: string } = await response.json();
      await res.session?.storeAction('purchase_screen_shown', null);
      resources.get().session?.reset();
      state.get().ian?.onShown();
      window.location.assign(data.url);
    } catch (e) {
      const err = await describeError(e);
      setVWC(subscribeErrorVWC, err);
    } finally {
      setVWC(redirectingVWC, false);
    }
  }, [
    activePackageIdxVWC,
    loginContextRaw.value,
    offerVWC,
    redirectingVWC,
    resources,
    subscribeErrorVWC,
    state,
  ]);

  const contentInnerRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const contentInnerHeightVWC = useWritableValueWithCallbacks<number>(() => 0);

  useValueWithCallbacksEffect(contentInnerRef, (eleUnch) => {
    if (eleUnch === null) {
      return undefined;
    }
    const ele = eleUnch;
    setVWC(contentInnerHeightVWC, ele.clientHeight);
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        handleResize();
      });
      ro.observe(ele);
      return () => {
        ro.disconnect();
      };
    } else {
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }

    function handleResize() {
      setVWC(contentInnerHeightVWC, ele.clientHeight);
    }
  });

  const backgroundOverlayStyle = useMappedValuesWithCallbacks(
    [backgroundImageState, contentInnerHeightVWC, windowSizeVWC],
    () => {
      const topUsingDisplayHeight = backgroundImageState.get().displayHeight - 100;
      const topUsingContentHeight = windowSizeVWC.get().height - contentInnerHeightVWC.get() - 20;
      const top = Math.min(topUsingDisplayHeight, topUsingContentHeight);
      const height = backgroundImageState.get().displayHeight - top;
      return {
        top,
        height,
      };
    },
    {
      outputEqualityFn: (a, b) => a.top === b.top && a.height === b.height,
    }
  );

  const backgroundOverlayRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  useValuesWithCallbacksEffect([backgroundOverlayRef, backgroundOverlayStyle], () => {
    const ele = backgroundOverlayRef.get();
    const style = backgroundOverlayStyle.get();
    if (ele !== null) {
      ele.style.top = `${style.top}px`;
      ele.style.height = `${style.height}px`;
    }
    return undefined;
  });

  return (
    <div className={styles.container}>
      <div className={styles.background} ref={(v) => setVWC(backgroundRefVWC, v)}>
        <OsehImageFromStateValueWithCallbacks state={backgroundImageState} />
        <div className={styles.belowImageBackground} />
      </div>
      <div
        className={styles.backgroundOverlay}
        style={Object.assign({}, backgroundOverlayStyle.get())}
        ref={(r) => setVWC(backgroundOverlayRef, r)}
      />
      <div className={styles.content}>
        <div className={styles.closeButtonContainer}>
          <IconButton
            icon={styles.closeIcon}
            srOnlyName="Close"
            onClick={(e) => {
              e.preventDefault();
              resources.get().session?.storeAction('close', null);
              resources.get().session?.reset();
              state.get().ian?.onShown();
              state.get().setContext(null, true);
            }}
          />
        </div>
        <div className={styles.contentInner} ref={(r) => setVWC(contentInnerRef, r)}>
          <RenderGuardedComponent
            props={useMappedValueWithCallbacks(state, (s) => s.context)}
            component={(ctx) => (
              <>
                <div className={styles.title}>
                  {(() => {
                    if (ctx?.type === 'series') {
                      return 'Get this series and more with Oseh+';
                    } else if (ctx?.type === 'longerClasses') {
                      return 'Extend your practice with longer classes on Oseh+';
                    } else {
                      return 'A deeper practice starts with Oseh+';
                    }
                  })()}
                </div>
                <div className={styles.valueProps}>
                  {valuePropsByContext(ctx?.type ?? 'generic').map((prop, idx) => (
                    <div key={idx} className={styles.valueProp}>
                      <div className={styles.valuePropIcon}>{prop.icon}</div>
                      <div className={styles.valuePropText}>{prop.text}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          />
          <RenderGuardedComponent
            props={useMappedValueWithCallbacks(resources, (r) => r.offer.error)}
            component={(error) => (error === null ? <></> : <ErrorBlock>{error}</ErrorBlock>)}
          />
          <RenderGuardedComponent
            props={offersAndPricesVWC}
            component={(offersAndPrices) => {
              return (
                <div
                  className={combineClasses(
                    styles.offers,
                    styles['offers' + offersAndPrices.length]
                  )}>
                  {offersAndPrices.map(([pkg, pkgPrice], idx) => (
                    <Offer
                      key={idx}
                      pkg={pkg}
                      price={pkgPrice}
                      idx={idx}
                      activeIdxVWC={activePackageIdxVWC}
                    />
                  ))}
                </div>
              );
            }}
          />
          <div className={styles.subscribeContainer}>
            <Button
              type="button"
              variant="filled-premium"
              onClick={async (e) => {
                e.preventDefault();
                handleSubscribe();
              }}>
              Subscribe
            </Button>
          </div>
          <RenderGuardedComponent
            props={activePriceVWC}
            component={(activePrice) => {
              if (activePrice === undefined || activePrice.productCategory !== 'SUBSCRIPTION') {
                return <></>;
              }
              return (
                <div className={styles.disclaimer}>
                  <div className={styles.disclaimerTitle}>Cancel anytime</div>
                  <div className={styles.disclaimerBody}>
                    You will be notified before subscription renewal.
                  </div>
                </div>
              );
            }}
          />
        </div>
      </div>
      <RenderGuardedComponent
        props={redirectingVWC}
        component={(working) => {
          if (!working) {
            return <></>;
          }
          return (
            <div className={styles.redirectingOverlay}>
              <InlineOsehSpinner
                size={{
                  type: 'react-rerender',
                  props: {
                    width: 80,
                  },
                }}
              />
            </div>
          );
        }}
      />
    </div>
  );
};

const ISO8601_PERIOD_TO_SHORTHAND: Record<string, string> = {
  P7D: '/wk',
  P1M: '/mo',
  P2M: '/2mo',
  P3M: '/3mo',
  P6M: '/6mo',
  P1Y: '/yr',
};

const ISO8601_PERIOD_TO_FREQUENCY: Record<string, string> = {
  P7D: 'Billed weekly',
  P1M: 'Billed monthly',
  P2M: 'Billed every other month',
  P3M: 'Billed quarterly',
  P6M: 'Billed semi-annually',
  P1Y: 'Billed annually',
};

const Offer = ({
  pkg,
  price,
  idx,
  activeIdxVWC,
}: {
  pkg: RevenueCatPackage;
  price: PurchasesStoreProduct;
  idx: number;
  activeIdxVWC: WritableValueWithCallbacks<number>;
}): ReactElement => {
  const refVWC = useWritableValueWithCallbacks<HTMLButtonElement | null>(() => null);

  useValuesWithCallbacksEffect([refVWC, activeIdxVWC], () => {
    const ref = refVWC.get();
    const activeIdx = activeIdxVWC.get();
    if (ref === null || activeIdx !== idx) {
      return undefined;
    }

    ref.classList.add(styles.offerActive);
    return () => {
      ref.classList.remove(styles.offerActive);
    };
  });

  const iso8601Period = price.defaultOption?.pricingPhases[0].billingPeriod.iso8601;
  const perStr =
    iso8601Period === undefined
      ? ' for life'
      : ISO8601_PERIOD_TO_SHORTHAND[iso8601Period] ?? ` / ${iso8601Period}`;

  const frequencyStr =
    iso8601Period === undefined
      ? 'Billed once'
      : ISO8601_PERIOD_TO_FREQUENCY[iso8601Period] ?? `Billed once per ${iso8601Period}`;

  return (
    <button
      type="button"
      ref={(v) => setVWC(refVWC, v)}
      className={styles.offer}
      onClick={(e) => {
        e.preventDefault();
        setVWC(activeIdxVWC, idx);
      }}>
      <div className={styles.offerPrice}>
        {price.priceString}
        {perStr}
      </div>

      <div className={styles.offerFrequency}>{frequencyStr}</div>
    </button>
  );
};

export const valuePropsByContext = (typ: string): { icon: ReactElement; text: string }[] => {
  if (typ === 'onboarding') {
    return [
      { icon: <>🌈</>, text: 'Reduce stress & anxiety' },
      { icon: <>🧠</>, text: 'Sharpen mental clarity' },
      { icon: <>❤️</>, text: 'Connect with yourself' },
      { icon: <>🌙</>, text: 'Improve sleep quality' },
    ];
  } else if (typ === 'past') {
    return [
      { icon: <div className={styles.iconClock} />, text: 'Take longer classes' },
      { icon: <div className={styles.iconSheet} />, text: 'Access the entire library' },
      { icon: <div className={styles.iconSeries} />, text: 'Explore expert-led series' },
      { icon: <>🧘</>, text: 'Reclaim your calm' },
    ];
  } else {
    return [
      { icon: <div className={styles.iconClock} />, text: 'Unlock longer classes' },
      { icon: <div className={styles.iconSheet} />, text: 'Access the entire library' },
      { icon: <div className={styles.iconSeries} />, text: 'Explore expert-led series' },
      { icon: <div className={styles.iconBrowse} />, text: 'Enhanced content browsing' },
    ];
  }
};
