import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
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

/**
 * Shows a basic settings screen for the user. Requires a login context and a modal
 * context.
 */
export const Settings = ({
  state,
  resources,
}: FeatureComponentProps<SettingsState, SettingsResources>) => {
  const loginContext = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const handleDeleteAccount = useHandleDeleteAccount(loginContext, modalContext, errorVWC);

  useErrorModal(modalContext.modals, errorVWC, 'settings');

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
        if (loginContext.state === 'logged-in') {
          loginContext.setAuthTokens(null);
          state.get().setShow(false, true);
        }
        return new Promise(() => {});
      },
    })
  );

  const accountLinks = useMemo(() => [myLibraryLink, logoutLink], [myLibraryLink, logoutLink]);

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

  return (
    <RenderGuardedComponent
      props={useMappedValueWithCallbacks(resources, (r) => r.loadError)}
      component={(loadError) => {
        if (loadError !== null) {
          return (
            <div className={styles.container}>
              <FullHeightDiv className={styles.background} />
              <div className={styles.contentContainer}>
                <div className={styles.closeButtonContainer}>
                  <IconButton icon={styles.closeIcon} srOnlyName="Close" onClick={onClickX} />
                </div>
                <div className={styles.content}>
                  <ErrorBlock>{loadError}</ErrorBlock>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className={styles.container}>
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
          </div>
        );
      }}
    />
  );
};
