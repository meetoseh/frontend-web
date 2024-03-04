import { ReactElement } from 'react';
import { ManageMembershipState } from './ManageMembershipState';
import { ManageMembershipResources } from './ManageMembershipResources';
import { FeatureComponentProps } from '../../models/Feature';
import styles from './ManageMembership.module.css';
import { FullHeightDiv } from '../../../../shared/components/FullHeightDiv';
import { BottomNavBar } from '../../../bottomNav/BottomNavBar';
import { IconButton } from '../../../../shared/forms/IconButton';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { ErrorBlock } from '../../../../shared/forms/ErrorBlock';
import { Button } from '../../../../shared/forms/Button';
import { valuePropsByContext } from '../upgrade/Upgrade';

/**
 * Tells the user if they have a membership. If they do, directs them to the
 * right place to manage it (if applicable)
 */
export const ManageMembership = ({
  state,
  resources,
}: FeatureComponentProps<ManageMembershipState, ManageMembershipResources>): ReactElement => {
  return (
    <div className={styles.container}>
      <FullHeightDiv className={styles.background} />
      <div className={styles.foreground}>
        <div className={styles.content}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <IconButton
                icon={styles.iconBack}
                srOnlyName="Back"
                onClick={(e) => {
                  e.preventDefault();
                  resources.get().gotoSettings();
                }}
              />
            </div>
            <div className={styles.headerCenter}>Manage Membership</div>
            <div className={styles.headerRight} />
          </div>
          <div className={styles.contentInner}>
            <div className={styles.title}>Status</div>
            <RenderGuardedComponent
              props={useMappedValueWithCallbacks(resources, (r) => r.havePro.error)}
              component={(e) => {
                if (e === null || e === undefined) {
                  return <></>;
                }
                return (
                  <div className={styles.errorContainer}>
                    <ErrorBlock>{e}</ErrorBlock>
                  </div>
                );
              }}
            />
            <RenderGuardedComponent
              props={useMappedValueWithCallbacks(resources, (r) => r.havePro)}
              component={(havePro) => {
                if (havePro.type === 'error') {
                  return (
                    <div className={styles.statusDetails}>
                      There was an error loading your membership status. Contact support at{' '}
                      <a href="mailto:hi@oseh.com">hi@oseh.com</a> if the problem persists.
                    </div>
                  );
                }

                if (havePro.type === 'loading') {
                  return <div className={styles.statusDetails}>Loading...</div>;
                }

                if (!havePro.value) {
                  return (
                    <>
                      <div className={styles.statusDetails}>
                        You do not have an Oseh+ subscription
                      </div>
                      <div className={styles.upgradeContainer}>
                        <Button
                          type="button"
                          fullWidth
                          variant="filled-premium"
                          onClick={(e) => {
                            e.preventDefault();
                            resources.get().gotoUpgrade();
                          }}>
                          Upgrade to Oseh+
                        </Button>
                      </div>
                    </>
                  );
                }

                if (havePro.recurrence.type === 'lifetime') {
                  return (
                    <>
                      <div className={styles.statusDetails}>You have lifetime access to Oseh+</div>
                      <div className={styles.lifetimeProps}>
                        <div className={styles.lifetimePropsTitle}>You can...</div>
                        <div className={styles.valueProps}>
                          {valuePropsByContext('past').map(({ icon, text }, idx) => (
                            <div key={idx} className={styles.valueProp}>
                              <div className={styles.valuePropIcon}>{icon}</div>
                              <div className={styles.valuePropText}>{text}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  );
                }

                if (havePro.platform === 'promotional') {
                  return (
                    <div className={styles.statusDetails}>
                      You have promotional access to Oseh+ until
                      {havePro.recurrence.cycleEndsAt.toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                  );
                }

                if (!havePro.recurrence.autoRenews) {
                  return (
                    <div className={styles.statusDetails}>
                      You have access to Oseh+ until{' '}
                      {havePro.recurrence.cycleEndsAt.toLocaleDateString(undefined, {
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
                  }[havePro.recurrence.period.iso8601] ?? 'membership';
                const details = (
                  <div className={styles.statusDetails}>
                    Your {simpleMembershipId} will renew on{' '}
                    {havePro.recurrence.cycleEndsAt.toLocaleDateString()}
                  </div>
                );

                if (havePro.platform === 'stripe') {
                  return (
                    <>
                      {details}
                      <div className={styles.customerPortalContainer}>
                        <Button
                          type="button"
                          variant="filled-white"
                          fullWidth
                          onClick={havePro.manageUrl}>
                          Go to Customer Portal
                        </Button>
                      </div>
                    </>
                  );
                }

                if (havePro.platform === 'ios') {
                  return (
                    <>
                      {details}
                      <div className={styles.storeInfo}>
                        <div className={styles.storeInfoTitle}>Manage through the App Store:</div>
                        <ol className={styles.storeInfoDetailsList}>
                          <li>On your apple device, visit the App Store</li>
                          <li>Tap Settings</li>
                          <li>Tap Subscriptions</li>
                          <li>Tap Oseh</li>
                        </ol>
                      </div>
                    </>
                  );
                }

                if (havePro.platform === 'google') {
                  return (
                    <>
                      {details}
                      <div className={styles.storeInfo}>
                        <div className={styles.storeInfoTitle}>Manage through Google Play:</div>
                        <ol className={styles.storeInfoDetailsList}>
                          <li>
                            On your Android device, go to{' '}
                            <a href="https://play.google.com/store/account/subscriptions">
                              subscriptions in Google Play
                            </a>
                          </li>
                          <li>Find Oseh in the list of subscriptions</li>
                          <li>Click Manage</li>
                        </ol>
                      </div>
                    </>
                  );
                }

                return (
                  <>
                    {details}
                    <div className={styles.storeInfo}>
                      <div className={styles.storeInfoTitle}>
                        Your membership will renew through {havePro.platform}
                      </div>
                    </div>
                  </>
                );
              }}
            />
          </div>
        </div>
        <div className={styles.bottomNav}>
          <BottomNavBar
            active="account"
            clickHandlers={{
              home: () => resources.get().gotoHome(),
              series: () => resources.get().gotoSeries(),
              account: () => resources.get().gotoSettings(),
            }}
          />
        </div>
      </div>
    </div>
  );
};
