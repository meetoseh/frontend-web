import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import {
  MappedValueWithCallbacksOpts,
  useMappedValueWithCallbacks,
} from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { FeatureComponentProps } from '../../models/Feature';
import { SettingsResources } from './SettingsResources';
import { SettingsState } from './SettingsState';
import styles from './Settings.module.css';
import { ErrorBlock } from '../../../../shared/forms/ErrorBlock';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ReactElement, useCallback, useContext, useMemo } from 'react';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { useErrorModal } from '../../../../shared/hooks/useErrorModal';
import { ModalContext } from '../../../../shared/contexts/ModalContext';
import { IconButton } from '../../../../shared/forms/IconButton';
import { FullHeightDiv } from '../../../../shared/components/FullHeightDiv';
import { useHandleDeleteAccount } from './hooks/useHandleDeleteAccount';
import { SettingLink, SettingsLinks } from './components/SettingLinks';
import { SettingSection } from './components/SettingSection';
import { useManageConnectWithProvider } from './hooks/useManageConnectWithProvider';
import { OauthProvider } from '../../../login/lib/OauthProvider';
import { BottomNavBar } from '../../../bottomNav/BottomNavBar';
import { combineClasses } from '../../../../shared/lib/combineClasses';

/**
 * Shows a basic settings screen for the user. Requires a login context and a modal
 * context.
 */
export const Settings = ({
  state,
  resources,
}: FeatureComponentProps<SettingsState, SettingsResources>) => {
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const handleDeleteAccount = useHandleDeleteAccount(loginContextRaw, modalContext, errorVWC);
  const mergeError = useWritableValueWithCallbacks<ReactElement | null>(() => null);

  useErrorModal(modalContext.modals, errorVWC, 'settings');
  useErrorModal(modalContext.modals, mergeError, 'merge account in settings');

  const onClickX = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      state.get().setShow(false, true);
    },
    [state]
  );

  const myLibraryLink = useWritableValueWithCallbacks(
    (): SettingLink => ({
      text: 'My Library',
      key: 'my-library',
      onClick: () => {
        resources.get().gotoMyLibrary();
        return undefined;
      },
    })
  );

  const logoutLink = useWritableValueWithCallbacks(
    (): SettingLink => ({
      text: 'Logout',
      key: 'logout',
      onClick: () => {
        const loginContextUnch = loginContextRaw.value.get();
        if (loginContextUnch.state === 'logged-in') {
          loginContextRaw.setAuthTokens(null);
          state.get().setShow(false, true);
        }
        return new Promise(() => {});
      },
    })
  );

  const haveProVWC = useMappedValueWithCallbacks(resources, (r) => r.havePro);
  const manageMembershipLink = useMappedValueWithCallbacks(
    haveProVWC,
    (havePro): SettingLink | null =>
      havePro
        ? {
            text: 'Manage Membership',
            key: 'manage-membership',
            onClick: () => {
              resources.get().gotoManageMembership();
              return undefined;
            },
          }
        : null
  );

  const accountLinks = useMemo(
    () => [myLibraryLink, manageMembershipLink, logoutLink],
    [myLibraryLink, manageMembershipLink, logoutLink]
  );

  const remindersLink = useWritableValueWithCallbacks(
    (): SettingLink => ({
      text: 'Reminders',
      key: 'edit-reminders',
      onClick: () => {
        resources.get().gotoEditReminderTimes();
        return undefined;
      },
    })
  );

  const settingsLinks = useMemo(() => [remindersLink], [remindersLink]);

  const contactSupportLink = useWritableValueWithCallbacks(
    (): SettingLink => ({
      text: 'Contact Support',
      key: 'contact-support',
      onClick: 'mailto:hi@oseh.com',
    })
  );

  const privacyPolicyLink = useWritableValueWithCallbacks(
    (): SettingLink => ({
      text: 'Privacy Policy',
      key: 'privacy-policy',
      onClick: 'https://www.oseh.com/privacy',
    })
  );

  const termsAndConditionsLink = useWritableValueWithCallbacks(
    (): SettingLink => ({
      text: 'Terms & Conditions',
      key: 'terms-and-conditions',
      onClick: 'https://www.oseh.com/terms',
    })
  );

  const deleteAccountLink = useWritableValueWithCallbacks(
    (): SettingLink => ({
      text: 'Delete Account',
      key: 'delete-account',
      onClick: () => {
        handleDeleteAccount();
        return undefined;
      },
    })
  );

  const supportLinks = useMemo(
    () => [contactSupportLink, privacyPolicyLink, termsAndConditionsLink, deleteAccountLink],
    [contactSupportLink, privacyPolicyLink, termsAndConditionsLink, deleteAccountLink]
  );

  const manageConnectWithProvider = useManageConnectWithProvider({
    resources,
    mergeError,
    modals: modalContext.modals,
  });

  const getLinkForProvider = useCallback(
    (r: SettingsResources, provider: OauthProvider, name: string): SettingLink | null => {
      if (provider === 'Dev' && process.env.REACT_APP_ENVIRONMENT !== 'dev') {
        return null;
      }

      const key = `connect-via-${provider}`;
      if (r.identities.type !== 'success') {
        return {
          text: `Connect ${name}`,
          details: r.identities.type === 'error' ? ['An error occurred'] : undefined,
          key,
          onClick: () => manageConnectWithProvider(provider, name),
        };
      }

      const providerIdentities = r.identities.identities.filter((i) => i.provider === provider);

      if (providerIdentities.length === 0) {
        return {
          text: `Connect ${name}`,
          key,
          onClick: () => manageConnectWithProvider(provider, name),
        };
      }

      return {
        text: `Connected with ${name}`,
        key,
        details: providerIdentities.map((i) => i.email ?? 'unknown'),
        onClick: () => manageConnectWithProvider(provider, name),
        action: 'none',
      };
    },
    [manageConnectWithProvider]
  );

  const identityOpts: MappedValueWithCallbacksOpts<SettingsResources, SettingLink | null> = {
    inputEqualityFn: (a, b) => Object.is(a.identities, b.identities),
  };

  const identityDirectLink = useMappedValueWithCallbacks(
    resources,
    (r) => getLinkForProvider(r, 'Direct', 'Email'),
    identityOpts
  );

  const identityGoogleLink = useMappedValueWithCallbacks(
    resources,
    (r) => getLinkForProvider(r, 'Google', 'Sign in with Google'),
    identityOpts
  );

  const identityAppleLink = useMappedValueWithCallbacks(
    resources,
    (r) => getLinkForProvider(r, 'SignInWithApple', 'Sign in with Apple'),
    identityOpts
  );

  const identityDevLink = useMappedValueWithCallbacks(
    resources,
    (r) => getLinkForProvider(r, 'Dev', 'Dev'),
    identityOpts
  );

  const identityLinks = useMemo(
    () => [identityDirectLink, identityGoogleLink, identityAppleLink, identityDevLink],
    [identityDirectLink, identityGoogleLink, identityAppleLink, identityDevLink]
  );

  return (
    <RenderGuardedComponent
      props={useMappedValueWithCallbacks(resources, (r) => ({
        loadError: r.loadError,
        navbar: r.navbar,
      }))}
      component={({ loadError, navbar }) => {
        const navbarEle = navbar ? (
          <div className={styles.bottomNav}>
            <BottomNavBar
              active="account"
              clickHandlers={{
                home: () => state.get().setShow(false, true),
                series: () => resources.get().gotoSeries(),
              }}
            />
          </div>
        ) : (
          <></>
        );
        const containerClass = combineClasses(
          styles.container,
          navbar ? styles.containerWithNavbar : undefined
        );
        if (loadError !== null) {
          return (
            <div className={containerClass}>
              <FullHeightDiv className={styles.background} />
              <div className={styles.contentContainer}>
                <div className={styles.closeButtonContainer}>
                  <IconButton icon={styles.closeIcon} srOnlyName="Close" onClick={onClickX} />
                </div>
                <div className={styles.content}>
                  <ErrorBlock>{loadError}</ErrorBlock>
                </div>
              </div>
              {navbarEle}
            </div>
          );
        }

        return (
          <div className={containerClass}>
            <FullHeightDiv className={styles.background} />
            <div className={styles.contentContainer}>
              <div className={styles.closeButtonContainer}>
                <IconButton icon={styles.closeIcon} srOnlyName="Close" onClick={onClickX} />
              </div>
              <div className={styles.content}>
                <div className={styles.sections}>
                  <SettingSection title="Account">
                    <SettingsLinks links={accountLinks} />
                  </SettingSection>
                  <SettingSection title="Logins">
                    <SettingsLinks links={identityLinks} />
                  </SettingSection>
                  <SettingSection title="Settings">
                    <SettingsLinks links={settingsLinks} />
                  </SettingSection>
                  <SettingSection title="Support">
                    <SettingsLinks links={supportLinks} />
                  </SettingSection>
                </div>
                <div className={styles.footer}>
                  <div className={styles.wordmark} />
                  <div className={styles.version}>
                    {process.env.REACT_APP_VERSION || 'development'}
                  </div>
                </div>
              </div>
            </div>
            {navbarEle}
          </div>
        );
      }}
    />
  );
};
