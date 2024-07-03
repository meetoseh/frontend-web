import { Fragment, ReactElement } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { MembershipResources } from './MembershipResources';
import { MembershipMappedParams } from './MembershipParams';
import {
  GRID_SIMPLE_NAVIGATION_FOREGROUND_BOTTOM_HEIGHT,
  GRID_SIMPLE_NAVIGATION_FOREGROUND_TOP_HEIGHT,
  GridSimpleNavigationForeground,
} from '../../../../shared/components/GridSimpleNavigationForeground';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import styles from './Membership.module.css';
import { Button } from '../../../../shared/forms/Button';
import { screenOut } from '../../lib/screenOut';
import { Clock } from '../upgrade/icons/Clock';
import { Sheet } from '../upgrade/icons/Sheet';
import { Series } from '../upgrade/icons/Series';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { HorizontalSpacer } from '../../../../shared/components/HorizontalSpacer';

/**
 * Gives the user basic information about their membership status, and directs
 * them to the appropriate place to update their membership if they want to.
 */
export const Membership = ({
  ctx,
  screen,
  resources,
  trace,
  startPop,
}: ScreenComponentProps<
  'membership',
  MembershipResources,
  MembershipMappedParams
>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  const isUrlExpired = useWritableValueWithCallbacks(() => false);
  useValueWithCallbacksEffect(resources.manageUrl, (manageUrlRaw) => {
    if (manageUrlRaw === null) {
      setVWC(isUrlExpired, false);
      return undefined;
    }
    const expiresAt = manageUrlRaw.expiresAt;
    if (expiresAt.getTime() < Date.now()) {
      setVWC(isUrlExpired, true);
      return undefined;
    }

    setVWC(isUrlExpired, false);
    let timeout: NodeJS.Timeout | null = setTimeout(() => {
      timeout = null;
      setVWC(isUrlExpired, true);
    }, expiresAt.getTime() - Date.now());
    return () => {
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    };
  });

  const wantGotoManageUrl = useWritableValueWithCallbacks(() => false);
  const manageUrlProps = useMappedValuesWithCallbacks(
    [resources.manageUrl, isUrlExpired],
    (): {
      onClick: React.MouseEventHandler<HTMLButtonElement> | string | undefined;
      onLinkClick: (() => void) | undefined;
      disabled: boolean;
      spinner: boolean;
    } => {
      const url = resources.manageUrl.get();
      if (url === null) {
        return {
          onClick: (e) => {
            e.preventDefault();
            trace({ type: 'manage-via-stripe', action: 'click', result: 'url-is-null' });
          },
          onLinkClick: undefined,
          disabled: true,
          spinner: true,
        };
      }

      const isExpired = isUrlExpired.get();
      if (isExpired) {
        return {
          onClick: (e) => {
            e.preventDefault();
            trace({ type: 'manage-via-stripe', action: 'click', result: 'url-is-expired' });
            setVWC(wantGotoManageUrl, true);
            url.reportExpired();
          },
          onLinkClick: undefined,
          disabled: false,
          spinner: wantGotoManageUrl.get(),
        };
      }

      if (wantGotoManageUrl.get()) {
        trace({ type: 'manage-via-stripe', action: 'now-available', result: 'redirect' });
        window.location.assign(url.url);
        return {
          onClick: undefined,
          onLinkClick: undefined,
          disabled: true,
          spinner: true,
        };
      }

      return {
        onClick: url.url,
        onLinkClick: () => {
          trace({ type: 'manage-via-stripe', action: 'click', result: 'native-link' });
        },
        disabled: false,
        spinner: false,
      };
    }
  );

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        contentWidthVWC={ctx.contentWidth}
        left={transitionState.left}
        opacity={transitionState.opacity}
        gridSizeVWC={ctx.windowSizeImmediate}
        justifyContent="flex-start">
        <VerticalSpacer height={GRID_SIMPLE_NAVIGATION_FOREGROUND_TOP_HEIGHT + 32} />
        <RenderGuardedComponent
          props={resources.pro}
          component={(entitlement) => {
            if (entitlement === null) {
              return (
                <div className={styles.statusDetails}>
                  Loading your membership status. If this lasts more than a few seconds, contact
                  support at <a href="mailto:hi@oseh.com">hi@oseh.com</a>
                </div>
              );
            }

            if (!entitlement.isActive) {
              return (
                <>
                  <div className={styles.statusDetails}>You do not have an Oseh+ subscription</div>
                  <VerticalSpacer height={24} />
                  <Button
                    type="button"
                    fullWidth
                    variant="filled-premium"
                    onClick={(e) => {
                      e.preventDefault();
                      screenOut(
                        workingVWC,
                        startPop,
                        transition,
                        screen.parameters.upgrade.exit,
                        screen.parameters.upgrade.trigger
                      );
                    }}>
                    Upgrade to Oseh+
                  </Button>
                </>
              );
            }

            if (entitlement.activeInfo === null && entitlement.expirationDate !== null) {
              return (
                <div className={styles.statusDetails}>
                  You have Oseh+ until {entitlement.expirationDate.toLocaleDateString()}. Contact
                  hi@oseh.com via email if you have any questions.
                </div>
              );
            }

            if (
              entitlement.activeInfo === null ||
              entitlement.activeInfo.recurrence.type === 'lifetime'
            ) {
              return (
                <>
                  <div className={styles.statusDetails}>You have lifetime access to Oseh+</div>
                  <VerticalSpacer height={24} />
                  <div className={styles.lifetimePropsTitle}>You can...</div>
                  <VerticalSpacer height={8} />
                  {[
                    { icon: <Clock />, text: 'Take longer classes' },
                    {
                      icon: <Sheet />,
                      text: 'Access the entire library',
                    },
                    {
                      icon: <Series />,
                      text: 'Explore expert-led series',
                    },
                    {
                      icon: <div style={{ fontSize: 17, lineHeight: 24 }}>🧘</div>,
                      text: 'Reclaim your calm',
                    },
                  ].map(({ icon, text }, idx) => (
                    <Fragment key={idx}>
                      {idx !== 0 && <VerticalSpacer height={8} />}
                      <div className={styles.valueProp}>
                        {icon}
                        <HorizontalSpacer width={8} />
                        <div className={styles.valuePropText}>{text}</div>
                      </div>
                    </Fragment>
                  ))}
                </>
              );
            }

            if (entitlement.activeInfo.platform === 'promotional') {
              return (
                <div className={styles.statusDetails}>
                  You have promotional access to Oseh+ until
                  {entitlement.activeInfo.recurrence.cycleEndsAt.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              );
            }

            if (!entitlement.activeInfo.recurrence.autoRenews) {
              return (
                <div className={styles.statusDetails}>
                  You have access to Oseh+ until{' '}
                  {entitlement.activeInfo.recurrence.cycleEndsAt.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              );
            }

            const simpleMembershipId =
              {
                P7D: 'weekly membership',
                P1M: 'monthly membership',
                P2M: 'bimonthly membership',
                P3M: 'quarterly membership',
                P6M: 'semiannual membership',
                P1Y: 'annual membership',
                PT5M: '5-minute (weekly or monthly test) membership',
                PT10M: '10-minute (quarterly test) membership',
                PT15M: '15-minute (semiannual test) membership',
                PT30M: '30-minute (annual test) membership',
              }[entitlement.activeInfo.recurrence.period.iso8601] ?? 'membership';
            const details = (
              <div className={styles.statusDetails}>
                Your {simpleMembershipId} will renew on{' '}
                {entitlement.activeInfo.recurrence.cycleEndsAt.toLocaleDateString()}
              </div>
            );

            if (entitlement.activeInfo.platform === 'stripe') {
              return (
                <>
                  {details}
                  <VerticalSpacer height={24} />
                  <RenderGuardedComponent
                    props={manageUrlProps}
                    component={(props) => (
                      <Button
                        type="button"
                        variant="filled-white"
                        fullWidth
                        onClick={props.onClick}
                        onLinkClick={props.onLinkClick}
                        disabled={props.disabled}
                        spinner={props.spinner}>
                        Go to Customer Portal
                      </Button>
                    )}
                  />
                </>
              );
            }

            if (entitlement.activeInfo.platform === 'ios') {
              return (
                <>
                  {details}
                  <VerticalSpacer height={24} />
                  <div className={styles.storeInfoTitle}>Manage through the App Store:</div>
                  <VerticalSpacer height={8} />
                  <div className={styles.storeInfo}>
                    • On your apple device, visit the App Store
                  </div>
                  <VerticalSpacer height={4} />
                  <div className={styles.storeInfo}>• Tap Settings</div>
                  <VerticalSpacer height={4} />
                  <div className={styles.storeInfo}>• Tap Subscriptions</div>
                  <VerticalSpacer height={4} />
                  <div className={styles.storeInfo}>• Tap Oseh</div>
                </>
              );
            }

            if (entitlement.activeInfo.platform === 'google') {
              return (
                <>
                  {details}
                  <VerticalSpacer height={24} />
                  <div className={styles.storeInfoTitle}>Manage through Google Play:</div>
                  <VerticalSpacer height={8} />
                  <div className={styles.storeInfo}>
                    • On your Android device, go to{' '}
                    <a href="https://play.google.com/store/account/subscriptions">
                      subscriptions in Google Play
                    </a>
                  </div>
                  <VerticalSpacer height={4} />
                  <div className={styles.storeInfo}>• Find Oseh in the list of subscriptions</div>
                  <VerticalSpacer height={4} />
                  <div className={styles.storeInfo}>• Click Manage</div>
                </>
              );
            }

            return (
              <>
                {details}
                <VerticalSpacer height={24} />
                <div className={styles.storeInfoTitle}>
                  Your membership will renew through {entitlement.activeInfo.platform}
                </div>
              </>
            );
          }}
        />
        <VerticalSpacer height={GRID_SIMPLE_NAVIGATION_FOREGROUND_BOTTOM_HEIGHT} />
      </GridContentContainer>
      <GridSimpleNavigationForeground
        workingVWC={workingVWC}
        startPop={startPop}
        gridSize={ctx.windowSizeImmediate}
        transitionState={transitionState}
        transition={transition}
        trace={trace}
        back={screen.parameters.back}
        home={screen.parameters.home}
        series={screen.parameters.series}
        account={null}
        title="Manage Membership"
      />
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
