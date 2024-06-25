import { Fragment, ReactElement, useContext } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { UpgradeCopy, UpgradeMappedParams } from './UpgradeParams';
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
import { RevenueCatPackage } from './models/RevenueCatPackage';
import { PurchasesStoreProduct } from './models/PurchasesStoreProduct';
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
import { ScreenImageParsed } from '../../models/ScreenImage';
import { HorizontalSpacer } from '../../../../shared/components/HorizontalSpacer';
import { Check } from '../series_details/icons/Check';
import {
  ParsedPeriod,
  extractPaidIntervalLength,
  extractTrialLength,
} from './lib/purchasesStoreProductHelper';

type Copy = UpgradeCopy<ScreenImageParsed>;

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
            thumbhash={useMappedValueWithCallbacks(
              resources.copy,
              (c) => c?.image?.thumbhash ?? null
            )}
          />
          <div className={styles.imageGridOverlay} />
        </GridFullscreenContainer>
      </GridContentContainer>
      <GridContentContainer
        contentWidthVWC={ctx.contentWidth}
        left={transitionState.left}
        opacity={transitionState.opacity}
        justifyContent="flex-start"
        gridSizeVWC={ctx.windowSizeImmediate}>
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
        <VerticalSpacer height={16} flexGrow={1} />
        <RenderGuardedComponent
          props={useMappedValuesWithCallbacks([resources.copy, resources.trial], () => ({
            copy: resources.copy.get(),
            trial: resources.trial.get(),
          }))}
          component={(params) => <Marketing {...params} />}
        />
        <RenderGuardedComponent
          props={useMappedValuesWithCallbacks(
            [resources.offering, resources.prices, resources.trial],
            () => ({
              offering: resources.offering.get(),
              prices: resources.prices.get(),
              trial: resources.trial.get(),
            })
          )}
          component={({ offering, prices, trial }) => (
            <>
              {trial !== null && trial.count > 0 && offering?.packages.length === 1 ? (
                <div className={styles.oneOfferWithTrialInfo}>
                  Unlimited access for {makeTrialPretty(trial)}, then{' '}
                  {(() => {
                    const priceVWC = prices.get(offering.packages[0].platformProductIdentifier);
                    if (priceVWC === undefined) {
                      return 'loading...';
                    }
                    const price = priceVWC.get();
                    if (price === null) {
                      return 'loading...';
                    }
                    const paidInterval = extractPaidIntervalLength(price);
                    const perStr =
                      paidInterval === null
                        ? ' for life'
                        : ISO8601_PERIOD_TO_SHORTHAND[paidInterval.iso8601] ??
                          ` / ${paidInterval.iso8601}`;

                    return `${price.priceString}${perStr}`;
                  })()}
                </div>
              ) : (
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
                                activeIdxVWC={resources.activePackageIdx}
                              />
                            )
                          }
                        />
                      </Fragment>
                    );
                  })}
                </div>
              )}
            </>
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

            const idx = resources.activePackageIdx.get();
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
          <RenderGuardedComponent
            props={resources.trial}
            component={(trial) =>
              trial === null || trial.count === 0 ? (
                <>Subscribe</>
              ) : (
                <>Try {makeTrialPretty(trial)} free</>
              )
            }
          />
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
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};

const Marketing = ({ copy, trial }: { copy: Copy; trial: ParsedPeriod | null }): ReactElement => {
  return (
    <>
      <div className={styles.header}>{substituteOfferInfo({ text: copy.header, trial })}</div>
      {copy.body.type === 'checklist' && <MarketingChecklist items={copy.body.items} />}
      {copy.body.type === 'sequence' && <MarketingSequence items={copy.body.items} />}
    </>
  );
};

const MarketingChecklist = ({ items }: { items: string[] }): ReactElement => (
  <>
    <VerticalSpacer height={16} />
    {items.map((item, idx) => (
      <Fragment key={idx}>
        {idx !== 0 && <VerticalSpacer height={8} />}
        <div className={styles.checklistItem}>
          <div className={styles.checklistIcon}>
            <Check />
          </div>
          <HorizontalSpacer width={16} />
          <div className={styles.checklistText}>{item}</div>
        </div>
      </Fragment>
    ))}
    <VerticalSpacer height={40} />
  </>
);

const MarketingSequence = ({
  items,
}: {
  items: {
    /** The icon utf-8 character */
    icon: string;
    /** The title */
    title: string;
    /** The body */
    body: string;
  }[];
}): ReactElement => (
  <>
    <VerticalSpacer height={48} />
    {items.map((item, idx) => (
      <Fragment key={idx}>
        {idx !== 0 && <VerticalSpacer height={24} />}
        <div className={styles.sequenceItem}>
          <div className={styles.sequenceIcon}>{item.icon}</div>
          <HorizontalSpacer width={16} />
          <div className={styles.sequenceText}>
            <div className={styles.sequenceTitle}>{item.title}</div>
            <VerticalSpacer height={8} />
            <div className={styles.sequenceBody}>{item.body}</div>
          </div>
        </div>
      </Fragment>
    ))}
    <VerticalSpacer height={60} />
  </>
);

const unitToPretty = {
  d: { singular: 'day', plural: 'days' },
  w: { singular: 'week', plural: 'weeks' },
  m: { singular: 'month', plural: 'months' },
  y: { singular: 'year', plural: 'years' },
} as const;

const makeTrialPretty = ({ count, unit }: ParsedPeriod): string => {
  return `${count.toLocaleString()} ${unitToPretty[unit][count === 1 ? 'singular' : 'plural']}`;
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

  const trial = extractTrialLength(price);
  const period = extractPaidIntervalLength(price);
  const perStr =
    period === null
      ? ' for life'
      : ISO8601_PERIOD_TO_SHORTHAND[period.iso8601] ?? ` / ${period.iso8601}`;

  const frequencyStr =
    period === null
      ? 'Billed once'
      : ISO8601_PERIOD_TO_FREQUENCY[period.iso8601] ?? `Billed once per ${period.iso8601}`;

  return (
    <button
      type="button"
      ref={(v) => setVWC(refVWC, v)}
      className={styles.offer}
      onClick={(e) => {
        e.preventDefault();
        setVWC(activeIdxVWC, idx);
      }}>
      {trial !== null && (
        <div className={styles.offerFrequency}>{makeTrialPretty(trial)} free then</div>
      )}

      <div className={styles.offerPrice}>
        {price.priceString}
        {perStr}
      </div>

      {trial === null && <div className={styles.offerFrequency}>{frequencyStr}</div>}
    </button>
  );
};

const substituteOfferInfo = ({ text, trial }: { text: string; trial: ParsedPeriod | null }) => {
  return text
    .replace(/\[trial_interval_count\]/g, trial?.count.toString() ?? '?')
    .replace(
      /\[trial_interval_unit_autoplural\]/g,
      trial === null
        ? '????'
        : trial.count === 1
        ? unitToPretty[trial.unit].singular
        : unitToPretty[trial.unit].plural
    )
    .replace(
      /\[trial_interval_unit_singular\]/g,
      trial === null ? '???' : unitToPretty[trial.unit].singular
    );
};
