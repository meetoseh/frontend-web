import { Fragment, ReactElement, useContext } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { UpgradeMappedParams } from './UpgradeParams';
import { UpgradeResources } from './UpgradeResources';
import {
  playEntranceTransition,
  playExitTransition,
  useEntranceTransition,
  useTransitionProp,
} from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import {
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import styles from './Upgrade.module.css';
import { setVWC } from '../../../../shared/lib/setVWC';
import assistiveStyles from '../../../../shared/assistive.module.css';
import { Back } from './icons/Back';
import { GridBlackBackground } from '../../../../shared/components/GridBlackBackground';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { GridImageBackground } from '../../../../shared/components/GridImageBackground';
import { useReactManagedValueAsValueWithCallbacks } from '../../../../shared/hooks/useReactManagedValueAsValueWithCallbacks';
import { Clock } from './icons/Clock';
import { Sheet } from './icons/Sheet';
import { Series } from './icons/Series';
import { Browse } from './icons/Browse';
import { RevenueCatPackage } from '../../features/upgrade/models/RevenueCatPackage';
import { PurchasesStoreProduct } from '../../features/upgrade/models/PurchasesStoreProduct';
import { useValuesWithCallbacksEffect } from '../../../../shared/hooks/useValuesWithCallbacksEffect';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { combineClasses } from '../../../../shared/lib/combineClasses';
import { Button } from '../../../../shared/forms/Button';
import { apiFetch } from '../../../../shared/ApiConstants';
import { useErrorModal } from '../../../../shared/hooks/useErrorModal';
import { ModalContext } from '../../../../shared/contexts/ModalContext';
import { screenOut } from '../../lib/screenOut';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';

/**
 * The upgrade screen, based on the users current offer but with a configurable
 * title.
 */
export const Upgrade = ({
  ctx,
  screen,
  resources,
  startPop,
  trace,
}: ScreenComponentProps<'upgrade', UpgradeResources, UpgradeMappedParams>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  useValueWithCallbacksEffect(resources.shouldSkip, (shouldSkip) => {
    if (workingVWC.get()) {
      return undefined;
    }

    if (shouldSkip) {
      setVWC(workingVWC, true);
      startPop({ slug: 'skip', parameters: {} })();
    }
    return undefined;
  });

  const activePackageIdxVWC = useWritableValueWithCallbacks<number>(() => 0);
  useValueWithCallbacksEffect(resources.offering, (offer) => {
    const activePackageIdx = activePackageIdxVWC.get();
    if (offer === null || offer === undefined || offer.packages.length <= activePackageIdx) {
      setVWC(activePackageIdxVWC, 0);
    }
    return undefined;
  });

  const modalContext = useContext(ModalContext);
  const subscribeErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useErrorModal(modalContext.modals, subscribeErrorVWC, 'starting checkout session');

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridBlackBackground />
      <GridContentContainer
        contentWidthVWC={useMappedValueWithCallbacks(ctx.windowSizeImmediate, (s) => s.width)}
        left={transitionState.left}
        opacity={transitionState.opacity}
        justifyContent="flex-start"
        gridSizeVWC={ctx.windowSizeImmediate}>
        <GridFullscreenContainer windowSizeImmediate={resources.imageSizeImmediate}>
          <GridImageBackground
            image={resources.image}
            thumbhash={useReactManagedValueAsValueWithCallbacks(screen.parameters.image.thumbhash)}
          />
          <div className={styles.imageGridOverlay} />
        </GridFullscreenContainer>
      </GridContentContainer>
      <GridContentContainer
        contentWidthVWC={ctx.contentWidth}
        left={transitionState.left}
        opacity={transitionState.opacity}
        justifyContent="space-between"
        gridSizeVWC={ctx.windowSizeImmediate}>
        <div className={styles.top}>
          <VerticalSpacer height={20} />
          <button
            type="button"
            className={styles.back}
            onClick={async (e) => {
              e.preventDefault();
              screenOut(
                workingVWC,
                startPop,
                transition,
                screen.parameters.exit,
                screen.parameters.back,
                {
                  beforeDone: async () => {
                    trace({ type: 'back' });
                  },
                }
              );
            }}>
            <span className={assistiveStyles.srOnly}>Back</span>
            <Back />
          </button>
        </div>
        <div className={styles.foreground}>
          <div className={styles.header}>{screen.parameters.header}</div>
          <VerticalSpacer height={16} />
          <div className={styles.valueProps}>
            <div className={styles.valueProp}>
              <div className={styles.valuePropIcon}>
                <Clock />
              </div>
              <div className={styles.valuePropText}>Unlock longer classes</div>
            </div>
            <VerticalSpacer height={12} />
            <div className={styles.valueProp}>
              <div className={styles.valuePropIcon}>
                <Sheet />
              </div>
              <div className={styles.valuePropText}>Access the entire library</div>
            </div>
            <VerticalSpacer height={12} />
            <div className={styles.valueProp}>
              <div className={styles.valuePropIcon}>
                <Series />
              </div>
              <div className={styles.valuePropText}>Explore expert-led series</div>
            </div>
            <VerticalSpacer height={12} />
            <div className={styles.valueProp}>
              <div className={styles.valuePropIcon}>
                <Browse />
              </div>
              <div className={styles.valuePropText}>Enhanced content browsing</div>
            </div>
          </div>
          <VerticalSpacer height={40} />
          <RenderGuardedComponent
            props={useMappedValuesWithCallbacks([resources.offering, resources.prices], () => ({
              offering: resources.offering.get(),
              prices: resources.prices.get(),
            }))}
            component={({ offering, prices }) => (
              <div
                className={combineClasses(
                  styles.offers,
                  offering === null || offering === undefined
                    ? undefined
                    : styles[`offers${offering.packages.length}`]
                )}>
                {offering?.packages?.map((pkg, idx) => {
                  const priceVWC = prices.get(pkg.platformProductIdentifier);
                  if (priceVWC === null || priceVWC === undefined) {
                    return null;
                  }
                  return (
                    <Fragment key={idx}>
                      {idx !== 0 && offering?.packages?.length > 2 && (
                        <VerticalSpacer height={16} />
                      )}
                      <RenderGuardedComponent
                        props={priceVWC}
                        component={(price) =>
                          price === null ? (
                            <></>
                          ) : (
                            <Offer
                              pkg={pkg}
                              price={price}
                              idx={idx}
                              activeIdxVWC={activePackageIdxVWC}
                            />
                          )
                        }
                      />
                    </Fragment>
                  );
                })}
              </div>
            )}
          />
          <VerticalSpacer height={24} />
          <Button
            type="button"
            variant="filled-premium"
            fullWidth
            onClick={async (e) => {
              e.preventDefault();
              if (workingVWC.get()) {
                return;
              }

              const idx = activePackageIdxVWC.get();
              const pkg = resources.offering.get()?.packages?.[idx];
              if (pkg === null || pkg === undefined) {
                trace({ type: 'error', message: 'subscribe pressed but pkg is null or undefined' });
                return;
              }

              const price = resources.prices.get().get(pkg.platformProductIdentifier)?.get();
              if (price === null || price === undefined) {
                trace({
                  type: 'error',
                  message: 'subscribe pressed but price is null or undefined',
                });
                return;
              }

              const loginContext = ctx.login.value.get();
              if (loginContext.state !== 'logged-in') {
                trace({ type: 'error', message: 'subscribe pressed but not logged in' });
                return;
              }

              setVWC(workingVWC, true);
              trace({ type: 'subscribeStart', pkg, price });
              const exitPromise = playExitTransition(transition);
              try {
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

                startPop(null);
                const data: { url: string } = await response.json();
                trace({ type: 'subscribeRedirecting' });
                window.location.href = data.url;
              } catch (e) {
                trace({ type: 'subscribeError', error: `${e}` });
                setVWC(workingVWC, false);
                exitPromise.cancel();
                playEntranceTransition(transition);
              }
            }}>
            Subscribe
          </Button>
          <VerticalSpacer height={16} />
          <a href="https://www.oseh.com/terms" className={styles.disclaimer}>
            <div className={styles.disclaimerTitle}>Cancel anytime.</div>
            <VerticalSpacer height={2} />
            <div className={styles.disclaimerBody}>
              You will be notified before subscription renewal.
            </div>
            <div className={styles.disclaimerTerms}>Terms & Conditions</div>
          </a>
          <VerticalSpacer height={32} />
        </div>
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
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
