import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  describeError,
  describeErrorFromResponse,
  ErrorBlock,
} from '../../shared/forms/ErrorBlock';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { LoginContext, LoginContextValue } from '../../shared/LoginContext';
import { addModalWithCallbackToRemove, ModalContext } from '../../shared/ModalContext';
import { ModalWrapper } from '../../shared/ModalWrapper';
import '../../assets/fonts.css';
import styles from './Settings.module.css';
import assistiveStyles from '../../shared/assistive.module.css';
import { apiFetch } from '../../shared/ApiConstants';
import { NewUserDailyEventInvite } from '../referral/models/NewUserDailyEventInvite';
import { getDailyEventInvite } from '../referral/lib/getDailyEventInvite';
import { joinWithCommas } from '../../shared/lib/joinWithCommas';

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
  const [havePro, setHavePro] = useState(false);
  const [showCancelInitialPrompt, setShowCancelInitialPrompt] = useState(false);
  const [showCancelApplePrompt, setShowCancelApplePrompt] = useState(false);
  const [showCancelPromoPrompt, setShowCancelPromoPrompt] = useState(false);
  const [showCancelNoSubscriptionPrompt, setShowCancelNoSubscriptionPrompt] = useState(false);
  const [showCancelSuccessPrompt, setShowCancelSuccessPrompt] = useState(false);
  const [showInviteFallbackPrompt, setShowInviteFallbackPrompt] = useState(false);
  const [preloadedInvite, setPreloadedInvite] = useState<NewUserDailyEventInvite | null>(null);
  const [error, setError] = useState<ReactElement | null>(null);

  const boundShowNotYetImplemented = useCallback(() => {
    setError(<>That's not implemented yet, but we're working on it!</>);
  }, []);

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
    let active = true;
    fetchHavePro();
    return () => {
      active = false;
    };
    async function fetchHavePro() {
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
      modalContext.setModals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="Are you sure you want to cancel your subscription?"
          body={
            <>
              You will lose access to Oseh+, including the ability to choose your own journey's,
              give access to friends, and more.
            </>
          }
          cta="Unsubscribe"
          onConfirm={tryCancel}
          onCancel={onCancel}
        />
      </ModalWrapper>
    );
  }, [showCancelInitialPrompt, modalContext.setModals, loginContext]);

  useEffect(() => {
    if (!showCancelApplePrompt) {
      return;
    }

    const onCancel = () => setShowCancelApplePrompt(false);

    return addModalWithCallbackToRemove(
      modalContext.setModals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="How to cancel your iOS subscription"
          body={
            <>
              Your subscription through Apple cannot be canceled automatically. To cancel, go to App
              Store &gt; Settings &gt; Subscriptions &gt; Oseh &gt; Cancel Subscription.
            </>
          }
          cta="Okay"
          onConfirm={null}
          onCancel={onCancel}
        />
      </ModalWrapper>
    );
  }, [showCancelApplePrompt, modalContext.setModals]);

  useEffect(() => {
    if (!showCancelPromoPrompt) {
      return;
    }

    const onCancel = () => setShowCancelPromoPrompt(false);

    return addModalWithCallbackToRemove(
      modalContext.setModals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="You will not be charged."
          body={
            <>
              You currently have promotional access to Oseh+. You will not be charged when your
              promotional period ends.
            </>
          }
          cta="Okay"
          onConfirm={null}
          onCancel={onCancel}
        />
      </ModalWrapper>
    );
  }, [showCancelPromoPrompt, modalContext.setModals]);

  useEffect(() => {
    if (!showCancelNoSubscriptionPrompt) {
      return;
    }

    const onCancel = () => setShowCancelNoSubscriptionPrompt(false);

    return addModalWithCallbackToRemove(
      modalContext.setModals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="You will not be charged."
          body={
            <>
              You do not have any recurring payments configured for Oseh+. You may still have access
              to Oseh+ for the remainder of the period or while your cancellation is processed.
            </>
          }
          cta="Okay"
          onConfirm={null}
          onCancel={onCancel}
        />
      </ModalWrapper>
    );
  }, [showCancelNoSubscriptionPrompt, modalContext.setModals]);

  useEffect(() => {
    if (!showCancelSuccessPrompt) {
      return;
    }

    const onCancel = () => setShowCancelSuccessPrompt(false);

    return addModalWithCallbackToRemove(
      modalContext.setModals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="Subscription canceled successfully"
          body={
            <>
              You have successfully canceled your subscription to Oseh+. You may still have access
              to Oseh+ for the remainder of the period or while your cancellation is processed.
            </>
          }
          cta="Okay"
          onConfirm={null}
          onCancel={onCancel}
        />
      </ModalWrapper>
    );
  }, [showCancelSuccessPrompt, modalContext.setModals]);

  useEffect(() => {
    if (!showInviteFallbackPrompt) {
      return;
    }

    const onCancel = () => setShowInviteFallbackPrompt(false);

    return addModalWithCallbackToRemove(
      modalContext.setModals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <InviteFallbackPrompt
          loginContext={loginContext}
          onCancel={onCancel}
          initialInvite={preloadedInvite}
        />
      </ModalWrapper>
    );
  }, [showInviteFallbackPrompt, modalContext.setModals, loginContext, preloadedInvite]);

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

  const inviteFriends = useCallback(async () => {
    if (loginContext.state !== 'logged-in') {
      return;
    }

    try {
      const invite = await getDailyEventInvite({
        loginContext,
        journeyUid: null,
      });

      const shareData = {
        url: invite.url,
        text: `Oseh has classes from ${joinWithCommas(invite.dailyEventInfo.instructors)} today! ${
          invite.url
        }`,
      };
      if (
        !invite.isPlusLink ||
        !window.navigator ||
        !window.navigator.share ||
        !window.navigator.canShare ||
        !window.navigator.canShare(shareData)
      ) {
        setPreloadedInvite(invite);
        setShowInviteFallbackPrompt(true);
        return;
      }

      await window.navigator.share(shareData);
    } catch (e) {
      console.error(e);
      setShowInviteFallbackPrompt(true);
    }
  }, [loginContext]);

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
            <button type="button" className={styles.bigLink} onClick={inviteFriends}>
              Invite Friends
            </button>
          </div>
          <div className={styles.bigLinkContainer}>
            {havePro ? (
              <button
                type="button"
                className={styles.bigLink}
                onClick={boundShowCancelInitialPrompt}>
                Cancel Oseh+
              </button>
            ) : (
              <a href="/upgrade" className={styles.bigLink}>
                Upgrade to Oseh+
              </a>
            )}
          </div>
          <div className={styles.bigLinkContainer}>
            <a href="mailto:hi@oseh.com" className={styles.bigLink}>
              Contact Support
            </a>
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

          <div className={styles.smallLinkContainer}>
            <button type="button" className={styles.smallLink} onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const InviteFallbackPrompt = ({
  loginContext,
  onCancel,
  initialInvite,
}: {
  loginContext: LoginContextValue;
  onCancel: (this: void) => void;
  initialInvite: NewUserDailyEventInvite | null;
}): ReactElement => {
  const [invite, setInvite] = useState<NewUserDailyEventInvite | null>(initialInvite);
  const [error, setError] = useState<ReactElement | null>(null);
  const [justCopied, setJustCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetchInvite();
    return () => {
      active = false;
    };

    async function fetchInvite() {
      if (loginContext.state !== 'logged-in') {
        return;
      }

      try {
        const inv = await getDailyEventInvite({ loginContext, journeyUid: null });
        if (active) {
          setInvite(inv);
        }
      } catch (e) {
        if (!active) {
          return;
        }
        console.error(e);
        setError(await describeError(e));
      }
    }
  }, [loginContext]);

  const inviteMessage: ReactElement | string | null = useMemo(() => {
    if (invite === null) {
      return null;
    }

    if (invite.isPlusLink) {
      return (
        <div className={styles.inviteText}>
          Use the following URL to invite friends and they will get Oseh+ for 24 hours, for free:{' '}
          <a href={invite.url} className={styles.inviteTextURL}>
            {invite.url}
          </a>
        </div>
      );
    }

    return (
      <div className={styles.inviteText}>
        Use the following URL to invite friends:{' '}
        <a href={invite.url} className={styles.inviteTextURL}>
          {invite.url}
        </a>
        <div className={styles.inviteUpsellText}>
          If you get Oseh+ then anyone who uses this link today can choose their journey.{' '}
          <a href="/upgrade" className={styles.inviteUpsellLink}>
            Upgrade Now
          </a>
          .
        </div>
      </div>
    );
  }, [invite]);

  const onConfirm = useCallback(async () => {
    if (invite === null) {
      return;
    }

    if (!(window.navigator && navigator.clipboard && navigator.clipboard.writeText)) {
      console.error('detected missing clipboard support');
      setError(<>Sorry, your browser does not support copying to the clipboard.</>);
      return;
    }

    try {
      await navigator.clipboard.writeText(invite.url);
      setJustCopied(true);
      setTimeout(() => {
        setJustCopied(false);
      }, 2000);
    } catch (e) {
      console.error(e);
      setError(<>Sorry, we were unable to copy to the clipboard.</>);
    }
  }, [invite]);

  return (
    <SettingsForceDelete
      title="Invite Friends"
      body={
        <>
          {invite === null || inviteMessage === null ? (
            <>Loading invite...</>
          ) : (
            <>{inviteMessage}</>
          )}
          {error !== null ? <ErrorBlock>{error}</ErrorBlock> : null}
        </>
      }
      cta={justCopied ? 'Copied' : 'Copy URL'}
      confirmDisabled={justCopied}
      onConfirm={onConfirm}
      onCancel={onCancel}
      cancelCta={invite === null ? 'Cancel' : 'Done'}
    />
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
  cancelCta = 'Cancel',
  confirmDisabled = false,
}: {
  title: ReactElement | string;
  body: ReactElement | string;
  cta: ReactElement | string | null;
  onConfirm: (() => Promise<void>) | null;
  onCancel: () => void;
  cancelCta?: ReactElement | string;
  confirmDisabled?: boolean;
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
      await onConfirm!();
    } finally {
      setConfirming(false);
    }
  }, [onConfirm]);

  return (
    <div className={styles.deleteConfirm}>
      <div className={styles.deleteConfirmTitle}>{title}</div>
      <div className={styles.deleteConfirmBody}>{body}</div>
      <div className={styles.deleteConfirmButtons}>
        {onConfirm !== null ? (
          <button
            className={`${styles.deleteConfirmButton} ${styles.deleteConfirmDeleteButton}`}
            disabled={ignoringDelete || confirming || confirmDisabled}
            onClick={doConfirm}>
            {cta}
          </button>
        ) : null}
        <button className={styles.deleteConfirmButton} onClick={onCancel} disabled={confirming}>
          {onConfirm !== null ? cancelCta : cta}
        </button>
      </div>
    </div>
  );
};
