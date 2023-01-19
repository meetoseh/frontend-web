import { ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import { describeErrorFromResponse, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { LoginContext } from '../../shared/LoginContext';
import { addModalWithCallbackToRemove, ModalContext } from '../../shared/ModalContext';
import { ModalWrapper } from '../../shared/ModalWrapper';
import '../../assets/fonts.css';
import styles from './Settings.module.css';
import assistiveStyles from '../../shared/assistive.module.css';
import { apiFetch } from '../../shared/ApiConstants';

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
  const [error, setError] = useState<ReactElement | null>(null);

  const boundShowNotYetImplemented = useCallback(() => {
    setError(<>That's not implemented yet, but we're working on it!</>);
  }, []);

  const boundShowDeleteConfirmInitialPrompt = useCallback(() => {
    setShowDeleteConfirmInitialPrompt(true);
  }, []);

  useEffect(() => {
    if (error === null) {
      return;
    }

    return addModalWithCallbackToRemove(
      modalContext.setModals,
      <ModalWrapper onClosed={() => setError(null)}>
        <ErrorBlock>{error}</ErrorBlock>
      </ModalWrapper>
    );
  }, [error, modalContext.setModals]);

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
          throw response;
        }

        await loginContext.setAuthTokens(null);
        window.location.href = '/';
      } catch (e) {
        if (e instanceof TypeError) {
          setError(<>Could not connect to server. Check your internet connection.</>);
        } else if (e instanceof Response) {
          if (e.status === 409) {
            const body = await e.json();
            console.log('conflict on delete:', body, 'force:', force);
            if (body.type === 'has_active_stripe_subscription') {
              setShowDeleteConfirmStripePrompt(true);
            } else if (body.type === 'has_active_ios_subscription') {
              setShowDeleteConfirmApplePrompt(true);
            } else if (body.type === 'has_active_google_subscription') {
              setShowDeleteConfirmGooglePrompt(true);
            } else if (body.type === 'has_active_promotional_subscription') {
              setShowDeleteConfirmPromoPrompt(true);
            } else {
              console.error('unexpected 409 for deleting account:', body);
              setError(
                <>
                  Your account requires special handling in order to be deleted. Contact hi@oseh.com
                  for assistance.
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

    const onCancel = () => setShowDeleteConfirmInitialPrompt(false);

    return addModalWithCallbackToRemove(
      modalContext.setModals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="Are you sure you want to delete your account?"
          body={
            <>
              Deleting your account will permanently lose your progress, history, and settings. Your
              associated personal data will be deleted where allowed by law. If you have purchased a
              subscription, it may not be canceled or refunded automatically.
            </>
          }
          cta="Delete"
          onConfirm={onDelete}
          onCancel={onCancel}
        />
      </ModalWrapper>
    );
  }, [showDeleteConfirmInitialPrompt, modalContext.setModals, deleteAccount, loginContext]);

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
      modalContext.setModals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="Are you sure you want to waive your subscription?"
          body={
            <>
              Your subscription through Apple will not be canceled automatically. To cancel, go to
              App Store &gt; Settings &gt; Subscriptions &gt; Oseh &gt; Cancel Subscription.
            </>
          }
          cta="Delete Anyway"
          onConfirm={onDelete}
          onCancel={onCancel}
        />
      </ModalWrapper>
    );
  }, [showDeleteConfirmApplePrompt, modalContext.setModals, deleteAccount]);

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
      modalContext.setModals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="Are you sure you want to cancel your subscription?"
          body={
            <>
              Your subscription through Google will be canceled automatically. You may receive a
              partial refund for the latest purchase in{' '}
              <span style={{ whiteSpace: 'nowrap' }}>5-7</span> business days. To cancel manually,
              open the Google Play app, at the top right, tap the profile icon, tap Payments &
              subscriptions &gt; Subscriptions, select the subcription you want to cancel, tap
              Cancel subscription, and follow the instructions.
            </>
          }
          cta="Unsubscribe and Delete Account"
          onConfirm={onDelete}
          onCancel={onCancel}
        />
      </ModalWrapper>
    );
  }, [showDeleteConfirmGooglePrompt, modalContext.setModals, deleteAccount]);

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
      modalContext.setModals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="Are you sure you want to cancel your subscription?"
          body={
            <>
              Your subscription through Stripe will be canceled automatically. You may receive a
              partial refund for the latest purchase in{' '}
              <span style={{ whiteSpace: 'nowrap' }}>5-7</span> business days.
            </>
          }
          cta="Unsubscribe and Delete Account"
          onConfirm={onDelete}
          onCancel={onCancel}
        />
      </ModalWrapper>
    );
  }, [showDeleteConfirmStripePrompt, modalContext.setModals, deleteAccount]);

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
      modalContext.setModals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="Are you sure you want to waive your access?"
          body={
            <>
              You currently have promotional access to Oseh+. If you delete your account, you will
              lose access to Oseh+ and may not be eligible for special offers in the future.
            </>
          }
          cta="Delete Anyway"
          onConfirm={onDelete}
          onCancel={onCancel}
        />
      </ModalWrapper>
    );
  }, [showDeleteConfirmPromoPrompt, modalContext.setModals, deleteAccount]);

  useEffect(() => {
    if (loginContext.state === 'logged-out') {
      window.location.href = '/';
    }
  }, [loginContext.state]);

  return (
    <div className={styles.container} style={{ minHeight: `${windowSize.height}px` }}>
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
          <div className={styles.bigLinkContainer}>
            <button type="button" className={styles.bigLink} onClick={boundShowNotYetImplemented}>
              Invite Friends
            </button>
          </div>
          <div className={styles.bigLinkContainer}>
            <button type="button" className={styles.bigLink} onClick={boundShowNotYetImplemented}>
              Upgrade to Oseh+
            </button>
          </div>
          <div className={styles.bigLinkContainer}>
            <button type="button" className={styles.bigLink} onClick={boundShowNotYetImplemented}>
              Contact Support
            </button>
          </div>
          <div className={styles.bigLinkContainer}>
            <button type="button" className={styles.bigLink} onClick={boundShowNotYetImplemented}>
              Restore Purchase
            </button>
          </div>
          <div className={styles.bigLinkContainer}>
            <button
              type="button"
              className={styles.bigLink}
              onClick={boundShowDeleteConfirmInitialPrompt}>
              Delete Account
            </button>
          </div>
        </div>
        <div className={styles.smallLinks}>
          <div className={styles.smallLinkContainer}>
            <button type="button" className={styles.smallLink} onClick={boundShowNotYetImplemented}>
              Privacy Policy
            </button>
          </div>

          <div className={styles.smallLinkContainer}>
            <button type="button" className={styles.smallLink} onClick={boundShowNotYetImplemented}>
              Terms & Conditions
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
const SettingsForceDelete = ({
  title,
  body,
  cta,
  onConfirm,
  onCancel,
}: {
  title: ReactElement | string;
  body: ReactElement | string;
  cta: ReactElement | string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}): ReactElement => {
  const [ignoringDelete, setIgnoringDelete] = useState(true);
  const [confirming, setConfirming] = useState(false);

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
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  }, [onConfirm]);

  return (
    <div className={styles.deleteConfirm}>
      <div className={styles.deleteConfirmTitle}>{title}</div>
      <div className={styles.deleteConfirmBody}>{body}</div>
      <div className={styles.deleteConfirmButtons}>
        <button
          className={`${styles.deleteConfirmButton} ${styles.deleteConfirmDeleteButton}`}
          disabled={ignoringDelete || confirming}
          onClick={doConfirm}>
          {cta}
        </button>
        <button className={styles.deleteConfirmButton} onClick={onCancel} disabled={confirming}>
          Cancel
        </button>
      </div>
    </div>
  );
};
