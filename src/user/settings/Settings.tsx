import { ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import {
  describeError,
  describeErrorFromResponse,
  ErrorBlock,
} from '../../shared/forms/ErrorBlock';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { addModalWithCallbackToRemove, ModalContext } from '../../shared/contexts/ModalContext';
import { ModalWrapper } from '../../shared/ModalWrapper';
import '../../assets/fonts.css';
import styles from './Settings.module.css';
import assistiveStyles from '../../shared/assistive.module.css';
import { apiFetch } from '../../shared/ApiConstants';
import { SplashScreen } from '../splash/SplashScreen';

/**
 * Shows a basic settings screen for the user. Requires a login context and a modal
 * context.
 */
export const Settings = () => {
  const modalContext = useContext(ModalContext);
  const loginContext = useContext(LoginContext);
  const windowSize = useWindowSize();
  const [showDeleteConfirmInitialPrompt, setShowDeleteConfirmInitialPrompt] = useState(false);
  const [showDeleteConfirmApplePrompt, setShowDeleteConfirmApplePrompt] = useState(false);
  const [showDeleteConfirmGooglePrompt, setShowDeleteConfirmGooglePrompt] = useState(false);
  const [showDeleteConfirmStripePrompt, setShowDeleteConfirmStripePrompt] = useState(false);
  const [showDeleteConfirmPromoPrompt, setShowDeleteConfirmPromoPrompt] = useState(false);
  const [havePro, setHavePro] = useState<boolean | null>(null);
  const [showCancelInitialPrompt, setShowCancelInitialPrompt] = useState(false);
  const [showCancelApplePrompt, setShowCancelApplePrompt] = useState(false);
  const [showCancelPromoPrompt, setShowCancelPromoPrompt] = useState(false);
  const [showCancelNoSubscriptionPrompt, setShowCancelNoSubscriptionPrompt] = useState(false);
  const [showCancelSuccessPrompt, setShowCancelSuccessPrompt] = useState(false);
  const [error, setError] = useState<ReactElement | null>(null);

  const boundShowDeleteConfirmInitialPrompt = useCallback(() => {
    setShowDeleteConfirmInitialPrompt(true);
  }, []);

  const boundShowCancelInitialPrompt = useCallback(() => {
    setShowCancelInitialPrompt(true);
  }, []);

  useEffect(() => {
    if (error === null) {
      return;
    }

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <ModalWrapper onClosed={() => setError(null)}>
        <ErrorBlock>{error}</ErrorBlock>
      </ModalWrapper>
    );
  }, [error, modalContext.modals]);

  const deleteAccount = useCallback(
    async (force: boolean): Promise<void> => {
      if (loginContext.state !== 'logged-in') {
        setError(<>Try logging in again first.</>);
        return;
      }

      try {
        const response = await apiFetch(
          `/api/1/users/me/account?${new URLSearchParams({ force: force ? '1' : '0' })}`,
          {
            method: 'DELETE',
          },
          loginContext
        );

        if (!response.ok) {
          if (!force && response.status === 409) {
            const body: {
              type:
                | 'has_active_stripe_subscription'
                | 'has_active_ios_subscription'
                | 'has_active_google_subscription'
                | 'has_active_promotional_subscription';
            } = await response.json();
            if (body.type === 'has_active_stripe_subscription') {
              setShowDeleteConfirmStripePrompt(true);
              return;
            } else if (body.type === 'has_active_ios_subscription') {
              setShowDeleteConfirmApplePrompt(true);
              return;
            } else if (body.type === 'has_active_google_subscription') {
              setShowDeleteConfirmGooglePrompt(true);
              return;
            } else if (body.type === 'has_active_promotional_subscription') {
              setShowDeleteConfirmPromoPrompt(true);
              return;
            } else {
              console.log('Unknown conflict type', body.type);
              setError(<>E_A7015: Contact hi@oseh.com for assistance.</>);
              return;
            }
          }
          throw response;
        }

        await loginContext.setAuthTokens(null);
        window.location.href = '/';
      } catch (e) {
        console.error(e);
        const err = await describeError(e);
        setError(err);
      }
    },
    [loginContext]
  );

  useEffect(() => {
    if (loginContext.state !== 'logged-in') {
      return;
    }

    if (!showDeleteConfirmInitialPrompt) {
      return;
    }

    const onDelete = async () => {
      try {
        await deleteAccount(false);
      } finally {
        setShowDeleteConfirmInitialPrompt(false);
      }
    };

    const onCancel = async () => setShowDeleteConfirmInitialPrompt(false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="Are you sure you want to delete your account?"
          body={
            <>
              By deleting your account, all your progress and history will be permanently lost. If
              you have a subscription, we recommend you manually unsubscribe prior to deleting your
              account.
            </>
          }
          cta="Not Now"
          cancelCta="Delete"
          onConfirm={onCancel}
          onCancel={onDelete}
        />
      </ModalWrapper>
    );
  }, [showDeleteConfirmInitialPrompt, modalContext.modals, deleteAccount, loginContext]);

  useEffect(() => {
    if (!showDeleteConfirmApplePrompt) {
      return;
    }

    const onDelete = async () => {
      try {
        await deleteAccount(true);
      } finally {
        setShowDeleteConfirmApplePrompt(false);
      }
    };

    const onCancel = () => setShowDeleteConfirmApplePrompt(false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="To unsubscribe from Oseh+"
          body={
            <>
              Visit the App Store &gt; Settings &gt; Subscriptions &gt; Oseh &gt; Cancel
              subscription.
            </>
          }
          cta="Cancel"
          cancelCta="Delete my account"
          onConfirm={onCancel}
          onCancel={onDelete}
        />
      </ModalWrapper>
    );
  }, [showDeleteConfirmApplePrompt, modalContext.modals, deleteAccount]);

  useEffect(() => {
    if (!showDeleteConfirmGooglePrompt) {
      return;
    }

    const onDelete = async () => {
      try {
        await deleteAccount(true);
      } finally {
        setShowDeleteConfirmGooglePrompt(false);
      }
    };

    const onCancel = () => setShowDeleteConfirmGooglePrompt(false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="To unsubscribe from Oseh+"
          body={
            <>
              Open the Google Play app, at the top right, tap the profile icon, tap Payments &
              subscriptions &gt; Subscriptions, select the subcription you want to cancel, tap
              Cancel subscription, and follow the instructions.
            </>
          }
          cta="Cancel"
          cancelCta="Delete my account"
          onConfirm={onCancel}
          onCancel={onDelete}
        />
      </ModalWrapper>
    );
  }, [showDeleteConfirmGooglePrompt, modalContext.modals, deleteAccount]);

  useEffect(() => {
    if (!showDeleteConfirmStripePrompt) {
      return;
    }

    const onDelete = async () => {
      try {
        await deleteAccount(true);
      } finally {
        setShowDeleteConfirmStripePrompt(false);
      }
    };

    const onCancel = () => setShowDeleteConfirmStripePrompt(false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="Are you sure you want to cancel your subscription?"
          body={
            <>
              By unsubscribing, you will lose access to Oseh+ including choosing your own journeys,
              unlocking more classes each day, and inviting friends for free.
            </>
          }
          cta="Cancel"
          cancelCta="Unsubscribe and Delete Account"
          onConfirm={onCancel}
          onCancel={onDelete}
        />
      </ModalWrapper>
    );
  }, [showDeleteConfirmStripePrompt, modalContext.modals, deleteAccount]);

  useEffect(() => {
    if (!showDeleteConfirmPromoPrompt) {
      return;
    }

    const onDelete = async () => {
      try {
        await deleteAccount(true);
      } finally {
        setShowDeleteConfirmPromoPrompt(false);
      }
    };

    const onCancel = () => setShowDeleteConfirmPromoPrompt(false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="You do not have an active subscription."
          body={<>You were gifted free access and are currently not being charged.</>}
          cta="Cancel"
          cancelCta="Delete my account"
          onConfirm={onCancel}
          onCancel={onDelete}
        />
      </ModalWrapper>
    );
  }, [showDeleteConfirmPromoPrompt, modalContext.modals, deleteAccount]);

  useEffect(() => {
    let active = true;
    fetchHavePro();
    return () => {
      active = false;
    };
    async function fetchHavePro() {
      if (loginContext.state === 'loading') {
        return;
      }

      if (loginContext.state !== 'logged-in') {
        setHavePro(false);
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

  useEffect(() => {
    if (!showCancelInitialPrompt) {
      return;
    }

    const tryCancel = async () => {
      try {
        const response = await apiFetch(
          '/api/1/users/me/subscription',
          {
            method: 'DELETE',
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        setShowCancelSuccessPrompt(true);
      } catch (e) {
        if (e instanceof TypeError) {
          setError(<>Could not connect to server. Check your internet connection.</>);
        } else if (e instanceof Response) {
          if (e.status === 409) {
            const body = await e.json();
            console.log('conflict on cancel:', body);
            if (body.type === 'no_active_subscription') {
              setShowCancelNoSubscriptionPrompt(true);
            } else if (body.type === 'has_active_ios_subscription') {
              setShowCancelApplePrompt(true);
            } else if (body.type === 'has_active_promotional_subscription') {
              setShowCancelPromoPrompt(true);
            } else {
              console.error('unexpected 409 for deleting account:', body);
              setError(
                <>
                  Your subscription requires special handling in order to be canceled. Contact
                  hi@oseh.com for assistance.
                </>
              );
            }
          } else {
            console.error('unexpected response for deleting account:', e);
            setError(await describeErrorFromResponse(e));
          }
        } else {
          console.error('unexpected error for deleting account:', e);
          setError(<>An unexpected error occurred. Contact hi@oseh.com for assistance.</>);
        }
      } finally {
        setShowCancelInitialPrompt(false);
      }
    };

    const onCancel = () => setShowCancelInitialPrompt(false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="Are you sure you want to unsubscribe from Oseh+?"
          body={
            <>
              By unsubscribing, you will lose access to Oseh+ including choosing your own journeys,
              unlocking more classes each day, and inviting friends for free.
            </>
          }
          cta="Not Now"
          cancelCta="Unsubscribe"
          onConfirm={onCancel}
          onCancel={tryCancel}
        />
      </ModalWrapper>
    );
  }, [showCancelInitialPrompt, modalContext.modals, loginContext]);

  useEffect(() => {
    if (!showCancelApplePrompt) {
      return;
    }

    const onCancel = () => setShowCancelApplePrompt(false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="To unsubscribe from Oseh+"
          body={
            <>
              Visit the App Store &gt; Settings &gt; Subscriptions &gt; Oseh &gt; Cancel
              subscription.
            </>
          }
          cta="Okay"
          onConfirm={null}
          onCancel={onCancel}
        />
      </ModalWrapper>
    );
  }, [showCancelApplePrompt, modalContext.modals]);

  useEffect(() => {
    if (!showCancelPromoPrompt) {
      return;
    }

    const onCancel = () => setShowCancelPromoPrompt(false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="You do not have an active subscription."
          body={<>You were gifted free access and are currently not being charged.</>}
          cta="Okay"
          onConfirm={null}
          onCancel={onCancel}
        />
      </ModalWrapper>
    );
  }, [showCancelPromoPrompt, modalContext.modals]);

  useEffect(() => {
    if (!showCancelNoSubscriptionPrompt) {
      return;
    }

    const onCancel = () => setShowCancelNoSubscriptionPrompt(false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="You’ve already cancelled your subscription to Oseh+"
          body={
            <>
              You do not have a recurring subscription. Access will end after your current billing
              period.
            </>
          }
          cta="Okay"
          onConfirm={null}
          onCancel={onCancel}
        />
      </ModalWrapper>
    );
  }, [showCancelNoSubscriptionPrompt, modalContext.modals]);

  useEffect(() => {
    if (!showCancelSuccessPrompt) {
      return;
    }

    const onCancel = () => setShowCancelSuccessPrompt(false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="You are no longer subscribed to Oseh+."
          body={<>You may continue to have access for a short period of time.</>}
          cta="Okay"
          onConfirm={null}
          onCancel={onCancel}
        />
      </ModalWrapper>
    );
  }, [showCancelSuccessPrompt, modalContext.modals]);

  useEffect(() => {
    if (loginContext.state === 'logged-out') {
      window.location.href = '/';
    }
  }, [loginContext.state]);

  const logout = useCallback(() => {
    if (loginContext.state === 'logged-in') {
      loginContext.setAuthTokens(null);
    }
  }, [loginContext]);

  if (error === null && havePro === null) {
    return <SplashScreen />;
  }

  return (
    <div className={styles.container} style={{ minHeight: `${windowSize.height}px` }}>
      {error && <ErrorBlock>{error}</ErrorBlock>}
      <div className={styles.closeButtonContainer}>
        <div className={styles.closeButtonInnerContainer}>
          <a href="/" className={styles.close}>
            <div className={styles.closeIcon} />
            <div className={assistiveStyles.srOnly}>Close</div>
          </a>
        </div>
      </div>
      <div className={styles.content}>
        <div className={styles.bigLinks}>
          {!havePro ? (
            <div className={styles.bigLinkContainer}>
              <a href="/upgrade" className={styles.bigLink}>
                Upgrade to Oseh+
              </a>
            </div>
          ) : null}
          <div className={styles.bigLinkContainer}>
            <a href="mailto:hi@oseh.com" className={styles.bigLink}>
              Contact Support
            </a>
          </div>
          <div className={styles.bigLinkContainer}>
            <button type="button" className={styles.bigLink} onClick={logout}>
              Logout
            </button>
          </div>
        </div>
        <div className={styles.smallLinks}>
          <div className={styles.smallLinkContainer}>
            <a href="https://www.oseh.com/privacy" className={styles.smallLink}>
              Privacy Policy
            </a>
          </div>

          <div className={styles.smallLinkContainer}>
            <a href="https://www.oseh.com/terms" className={styles.smallLink}>
              Terms & Conditions
            </a>
          </div>

          {havePro ? (
            <div className={styles.smallLinkContainer}>
              <button
                type="button"
                className={styles.smallLink}
                onClick={boundShowCancelInitialPrompt}>
                Unsubscribe Oseh+
              </button>
            </div>
          ) : null}

          <div className={styles.smallLinkContainer}>
            <button
              type="button"
              className={styles.smallLink}
              onClick={boundShowDeleteConfirmInitialPrompt}>
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * The content of the modal we use when the user clicks "Delete Account".
 *
 * This is used both on the initial click, regardless of the users login state,
 * and on the second click, if we fail to delete their account because the
 * server returned a conflict which is resolvable with the `force=true` after
 * the user has made an additonal confirmation (e.g., that their apple subscription
 * will not be canceled).
 */
export const SettingsForceDelete = ({
  title,
  body,
  cta,
  onConfirm,
  onCancel,
  cancelCta = 'Cancel',
  confirmDisabled = false,
}: {
  title: ReactElement | string;
  body: ReactElement | string;
  cta: ReactElement | string | null;
  onConfirm: (() => Promise<void> | void) | null;
  onCancel: () => Promise<void> | void;
  cancelCta?: ReactElement | string;
  confirmDisabled?: boolean;
}): ReactElement => {
  const [ignoringDelete, setIgnoringDelete] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!ignoringDelete) {
      return;
    }

    let timeout: NodeJS.Timeout | null = setTimeout(() => {
      setIgnoringDelete(false);
      timeout = null;
    }, 2000);

    return () => {
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    };
  }, [ignoringDelete]);

  const doConfirm = useCallback(async () => {
    setConfirming(true);
    try {
      await onConfirm!();
    } finally {
      setConfirming(false);
    }
  }, [onConfirm]);

  const doCancel = useCallback(async () => {
    setCancelling(true);
    try {
      await onCancel();
    } finally {
      setCancelling(false);
    }
  }, [onCancel]);

  return (
    <div className={styles.deleteConfirm}>
      <div className={styles.deleteConfirmTitle}>{title}</div>
      <div className={styles.deleteConfirmBody}>{body}</div>
      <div className={styles.deleteConfirmButtons}>
        {onConfirm !== null ? (
          <button
            className={`${styles.deleteConfirmButton} ${styles.deleteConfirmDeleteButton}`}
            disabled={ignoringDelete || confirming || cancelling || confirmDisabled}
            onClick={doConfirm}>
            {cta}
          </button>
        ) : null}
        <button
          className={styles.deleteConfirmButton}
          onClick={doCancel}
          disabled={confirming || cancelling}>
          {onConfirm !== null ? cancelCta : cta}
        </button>
      </div>
    </div>
  );
};
