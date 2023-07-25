import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { FeatureComponentProps } from '../../models/Feature';
import { SettingsResources } from './SettingsResources';
import { SettingsState } from './SettingsState';
import styles from './Settings.module.css';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import {
  ErrorBlock,
  describeError,
  describeErrorFromResponse,
} from '../../../../shared/forms/ErrorBlock';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { ReactElement, useCallback, useContext } from 'react';
import { LoginContext, LoginContextValue } from '../../../../shared/contexts/LoginContext';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useErrorModal } from '../../../../shared/hooks/useErrorModal';
import {
  ModalContext,
  ModalContextValue,
  addModalWithCallbackToRemove,
} from '../../../../shared/contexts/ModalContext';
import { useTimedValueWithCallbacks } from '../../../../shared/hooks/useTimedValue';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { combineClasses } from '../../../../shared/lib/combineClasses';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { apiFetch } from '../../../../shared/ApiConstants';
import { ModalWrapper } from '../../../../shared/ModalWrapper';
import { IconButton } from '../../../../shared/forms/IconButton';
import { InlineOsehSpinner } from '../../../../shared/components/InlineOsehSpinner';

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
  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const haveProVWC = useMappedValueWithCallbacks(resources, (r) => r.havePro);
  const handleDeleteAccount = useHandleDeleteAccount(loginContext, modalContext, errorVWC);
  const handleCancelSubscription = useHandleCancelSubscription(
    loginContext,
    modalContext,
    errorVWC
  );

  const logout = useCallback(() => {
    if (loginContext.state === 'logged-in') {
      loginContext.setAuthTokens(null);
    }
  }, [loginContext]);

  useErrorModal(modalContext.modals, errorVWC, 'settings');

  const onClickX = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      state.get().setShow(false, true);
    },
    [state]
  );

  return (
    <RenderGuardedComponent
      props={useMappedValueWithCallbacks(resources, (r) => r.loadError)}
      component={(loadError) => {
        if (loadError !== null) {
          return (
            <div className={styles.container}>
              <div className={styles.imageContainer}>
                <RenderGuardedComponent
                  props={windowSizeVWC}
                  component={(windowSize) => (
                    <div
                      className={styles.background}
                      style={{ width: windowSize.width, height: windowSize.height }}
                    />
                  )}
                />
              </div>
              <div className={styles.content}>
                <ErrorBlock>{loadError}</ErrorBlock>
              </div>
            </div>
          );
        }

        return (
          <div className={styles.container}>
            <div className={styles.imageContainer}>
              <RenderGuardedComponent
                props={windowSizeVWC}
                component={(windowSize) => (
                  <div
                    className={styles.background}
                    style={{ width: windowSize.width, height: windowSize.height }}
                  />
                )}
              />
            </div>
            <div className={styles.closeButtonContainer}>
              <div className={styles.closeButtonInnerContainer}>
                <IconButton icon={styles.closeIcon} srOnlyName="Close" onClick={onClickX} />
              </div>
            </div>
            <div className={styles.content}>
              <div className={styles.bigLinks}>
                {/* <RenderGuardedComponent
                  props={haveProVWC}
                  component={(havePro) => (
                    <>
                      {!havePro ? (
                        <div className={styles.bigLinkContainer}>
                          <a href="/upgrade" className={styles.bigLink}>
                            Upgrade to Oseh+
                          </a>
                        </div>
                      ) : null}
                    </>
                  )}
                /> */}
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

                <RenderGuardedComponent
                  props={haveProVWC}
                  component={(havePro) => (
                    <>
                      {havePro ? (
                        <div className={styles.smallLinkContainer}>
                          <button
                            type="button"
                            className={styles.smallLink}
                            onClick={(e) => {
                              e.preventDefault();
                              handleCancelSubscription();
                            }}>
                            Unsubscribe Oseh+
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                />

                <div className={styles.smallLinkContainer}>
                  <button
                    type="button"
                    className={styles.smallLink}
                    onClick={(e) => {
                      e.preventDefault();
                      handleDeleteAccount();
                    }}>
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      }}
    />
  );
};

const useHandleDeleteAccount = (
  loginContext: LoginContextValue,
  modalContext: ModalContextValue,
  errorVWC: WritableValueWithCallbacks<ReactElement | null>
): (() => void) => {
  const showDeleteConfirmInitialPromptVWC = useWritableValueWithCallbacks(() => false);
  const showDeleteConfirmApplePromptVWC = useWritableValueWithCallbacks(() => false);
  const showDeleteConfirmGooglePromptVWC = useWritableValueWithCallbacks(() => false);
  const showDeleteConfirmStripePromptVWC = useWritableValueWithCallbacks(() => false);
  const showDeleteConfirmPromoPromptVWC = useWritableValueWithCallbacks(() => false);

  const deleteAccount = useCallback(
    async (force: boolean): Promise<void> => {
      if (loginContext.state !== 'logged-in') {
        setVWC(errorVWC, <>Try logging in again first.</>);
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
              setVWC(showDeleteConfirmStripePromptVWC, true);
              return;
            } else if (body.type === 'has_active_ios_subscription') {
              setVWC(showDeleteConfirmApplePromptVWC, true);
              return;
            } else if (body.type === 'has_active_google_subscription') {
              setVWC(showDeleteConfirmGooglePromptVWC, true);
              return;
            } else if (body.type === 'has_active_promotional_subscription') {
              setVWC(showDeleteConfirmPromoPromptVWC, true);
              return;
            } else {
              console.log('Unknown conflict type', body.type);
              setVWC(errorVWC, <>E_A7015: Contact hi@oseh.com for assistance.</>);
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
        setVWC(errorVWC, err);
      }
    },
    [
      loginContext,
      errorVWC,
      showDeleteConfirmApplePromptVWC,
      showDeleteConfirmGooglePromptVWC,
      showDeleteConfirmPromoPromptVWC,
      showDeleteConfirmStripePromptVWC,
    ]
  );

  useValueWithCallbacksEffect(
    showDeleteConfirmInitialPromptVWC,
    (showDeleteConfirmInitialPrompt) => {
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
          setVWC(showDeleteConfirmInitialPromptVWC, false);
        }
      };

      const onCancel = async () => setVWC(showDeleteConfirmInitialPromptVWC, false);

      return addModalWithCallbackToRemove(
        modalContext.modals,
        <ModalWrapper minimalStyling={true} onClosed={onCancel}>
          <SettingsForceDelete
            title="Are you sure you want to delete your account?"
            body={
              <>
                By deleting your account, all your progress and history will be permanently lost. If
                you have a subscription, we recommend you manually unsubscribe prior to deleting
                your account.
              </>
            }
            cta="Delete"
            cancelCta="Not Now"
            onConfirm={onDelete}
            onCancel={onCancel}
            flipButtons
          />
        </ModalWrapper>
      );
    }
  );

  useValueWithCallbacksEffect(showDeleteConfirmApplePromptVWC, (showDeleteConfirmApplePrompt) => {
    if (!showDeleteConfirmApplePrompt) {
      return;
    }

    const onDelete = async () => {
      try {
        await deleteAccount(true);
      } finally {
        setVWC(showDeleteConfirmApplePromptVWC, false);
      }
    };

    const onCancel = () => setVWC(showDeleteConfirmApplePromptVWC, false);

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
          cta="Delete my account"
          cancelCta="Cancel"
          onConfirm={onDelete}
          onCancel={onCancel}
          flipButtons
        />
      </ModalWrapper>
    );
  });

  useValueWithCallbacksEffect(showDeleteConfirmGooglePromptVWC, (showDeleteConfirmGooglePrompt) => {
    if (!showDeleteConfirmGooglePrompt) {
      return;
    }

    const onDelete = async () => {
      try {
        await deleteAccount(true);
      } finally {
        setVWC(showDeleteConfirmGooglePromptVWC, false);
      }
    };

    const onCancel = () => setVWC(showDeleteConfirmGooglePromptVWC, false);

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
          cta="Delete my account"
          cancelCta="Cancel"
          onConfirm={onDelete}
          onCancel={onCancel}
          flipButtons
        />
      </ModalWrapper>
    );
  });

  useValueWithCallbacksEffect(showDeleteConfirmStripePromptVWC, (showDeleteConfirmStripePrompt) => {
    if (!showDeleteConfirmStripePrompt) {
      return;
    }

    const onDelete = async () => {
      try {
        await deleteAccount(true);
      } finally {
        setVWC(showDeleteConfirmStripePromptVWC, false);
      }
    };

    const onCancel = () => setVWC(showDeleteConfirmStripePromptVWC, false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="Are you sure you want to cancel your subscription?"
          body={<>By unsubscribing, you will lose access to Oseh+.</>}
          cta="Unsubscribe and Delete Account"
          cancelCta="Cancel"
          onConfirm={onDelete}
          onCancel={onCancel}
          flipButtons
        />
      </ModalWrapper>
    );
  });

  useValueWithCallbacksEffect(showDeleteConfirmPromoPromptVWC, (showDeleteConfirmPromoPrompt) => {
    if (!showDeleteConfirmPromoPrompt) {
      return;
    }

    const onDelete = async () => {
      try {
        await deleteAccount(true);
      } finally {
        setVWC(showDeleteConfirmPromoPromptVWC, false);
      }
    };

    const onCancel = () => setVWC(showDeleteConfirmPromoPromptVWC, false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="You do not have an active subscription."
          body={<>You were gifted free access and are currently not being charged.</>}
          cta="Delete my account"
          cancelCta="Cancel"
          onConfirm={onDelete}
          onCancel={onCancel}
          flipButtons
        />
      </ModalWrapper>
    );
  });

  return useCallback(() => {
    setVWC(showDeleteConfirmInitialPromptVWC, true);
  }, [showDeleteConfirmInitialPromptVWC]);
};

const useHandleCancelSubscription = (
  loginContext: LoginContextValue,
  modalContext: ModalContextValue,
  errorVWC: WritableValueWithCallbacks<ReactElement | null>
): (() => void) => {
  const showCancelInitialPromptVWC = useWritableValueWithCallbacks(() => false);
  const showCancelApplePromptVWC = useWritableValueWithCallbacks(() => false);
  const showCancelPromoPromptVWC = useWritableValueWithCallbacks(() => false);
  const showCancelNoSubscriptionPromptVWC = useWritableValueWithCallbacks(() => false);
  const showCancelSuccessPromptVWC = useWritableValueWithCallbacks(() => false);

  useValueWithCallbacksEffect(showCancelInitialPromptVWC, (showCancelInitialPrompt) => {
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

        setVWC(showCancelSuccessPromptVWC, true);
      } catch (e) {
        if (e instanceof TypeError) {
          setVWC(errorVWC, <>Could not connect to server. Check your internet connection.</>);
        } else if (e instanceof Response) {
          if (e.status === 409) {
            const body = await e.json();
            console.log('conflict on cancel:', body);
            if (body.type === 'no_active_subscription') {
              setVWC(showCancelNoSubscriptionPromptVWC, true);
            } else if (body.type === 'has_active_ios_subscription') {
              setVWC(showCancelApplePromptVWC, true);
            } else if (body.type === 'has_active_promotional_subscription') {
              setVWC(showCancelPromoPromptVWC, true);
            } else {
              console.error('unexpected 409 for deleting account:', body);
              setVWC(
                errorVWC,
                <>
                  Your subscription requires special handling in order to be canceled. Contact
                  hi@oseh.com for assistance.
                </>
              );
            }
          } else {
            console.error('unexpected response for deleting account:', e);
            setVWC(errorVWC, await describeErrorFromResponse(e));
          }
        } else {
          console.error('unexpected error for deleting account:', e);
          setVWC(errorVWC, <>An unexpected error occurred. Contact hi@oseh.com for assistance.</>);
        }
      } finally {
        setVWC(showCancelInitialPromptVWC, false);
      }
    };

    const onCancel = () => setVWC(showCancelInitialPromptVWC, false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="Are you sure you want to unsubscribe from Oseh+?"
          body={<>By unsubscribing, you will lose access to Oseh+.</>}
          cta="Unsubscribe"
          cancelCta="Not Now"
          onConfirm={tryCancel}
          onCancel={onCancel}
          flipButtons
        />
      </ModalWrapper>
    );
  });

  useValueWithCallbacksEffect(showCancelApplePromptVWC, (showCancelApplePrompt) => {
    if (!showCancelApplePrompt) {
      return;
    }

    const onCancel = () => setVWC(showCancelApplePromptVWC, false);

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
  });

  useValueWithCallbacksEffect(showCancelPromoPromptVWC, (showCancelPromoPrompt) => {
    if (!showCancelPromoPrompt) {
      return;
    }

    const onCancel = () => setVWC(showCancelPromoPromptVWC, false);

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
  });

  useValueWithCallbacksEffect(
    showCancelNoSubscriptionPromptVWC,
    (showCancelNoSubscriptionPrompt) => {
      if (!showCancelNoSubscriptionPrompt) {
        return;
      }

      const onCancel = () => setVWC(showCancelNoSubscriptionPromptVWC, false);

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
    }
  );

  useValueWithCallbacksEffect(showCancelSuccessPromptVWC, (showCancelSuccessPrompt) => {
    if (!showCancelSuccessPrompt) {
      return;
    }

    const onCancel = () => setVWC(showCancelSuccessPromptVWC, false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <ModalWrapper minimalStyling={true} onClosed={onCancel}>
        <SettingsForceDelete
          title="You are no longer subscribed to Oseh+."
          body={<>You will not be charged for Oseh+ unless you resubscribe.</>}
          cta="Okay"
          onConfirm={null}
          onCancel={onCancel}
        />
      </ModalWrapper>
    );
  });

  return useCallback(() => {
    setVWC(showCancelInitialPromptVWC, true);
  }, [showCancelInitialPromptVWC]);
};

const SettingsForceDelete = ({
  title,
  body,
  cta,
  onConfirm,
  onCancel,
  cancelCta = 'Cancel',
  confirmDisabled = false,
  flipButtons = false,
}: {
  title: ReactElement | string;
  body: ReactElement | string;
  cta: ReactElement | string | null;
  onConfirm: (() => Promise<void> | void) | null;
  onCancel: () => Promise<void> | void;
  cancelCta?: ReactElement | string;
  confirmDisabled?: boolean;
  flipButtons?: boolean;
}): ReactElement => {
  const ignoringDeleteVWC = useTimedValueWithCallbacks(true, false, 2000);
  const confirmingVWC = useWritableValueWithCallbacks(() => false);
  const cancellingVWC = useWritableValueWithCallbacks(() => false);

  const doConfirm = useCallback(async () => {
    if (confirmingVWC.get() || onConfirm === null) {
      return;
    }

    setVWC(confirmingVWC, true);
    try {
      await onConfirm();
    } finally {
      setVWC(confirmingVWC, false);
    }
  }, [onConfirm, confirmingVWC]);

  const doCancel = useCallback(async () => {
    if (cancellingVWC.get()) {
      return;
    }

    setVWC(cancellingVWC, true);
    try {
      await onCancel();
    } finally {
      setVWC(cancellingVWC, false);
    }
  }, [onCancel, cancellingVWC]);

  const confirmDisabledVWC = useMappedValuesWithCallbacks<
    boolean,
    ValueWithCallbacks<boolean>[],
    boolean
  >(
    [ignoringDeleteVWC, confirmingVWC, cancellingVWC],
    ([ignoringDelete, confirming, cancelling]) => {
      return confirmDisabled || ignoringDelete || confirming || cancelling;
    }
  );

  const cancelDisabledVWC = useMappedValuesWithCallbacks<
    boolean,
    ValueWithCallbacks<boolean>[],
    boolean
  >([confirmingVWC, cancellingVWC], ([confirming, cancelling]) => confirming || cancelling);

  const confirmButton = (
    <>
      {onConfirm !== null ? (
        <RenderGuardedComponent
          props={confirmDisabledVWC}
          component={(disabled) => (
            <button
              className={combineClasses(
                styles.deleteConfirmButton,
                flipButtons ? undefined : styles.deleteConfirmDeleteButton
              )}
              disabled={disabled}
              onClick={doConfirm}>
              {disabled && (
                <div className={styles.deleteSpinnerContainer}>
                  <InlineOsehSpinner
                    size={{ type: 'react-rerender', props: { height: 12 } }}
                    variant="black"
                  />
                </div>
              )}
              {cta}
            </button>
          )}
        />
      ) : null}
    </>
  );

  const cancelButton = (
    <RenderGuardedComponent
      props={cancelDisabledVWC}
      component={(disabled) => (
        <button
          className={combineClasses(
            styles.deleteConfirmButton,
            !flipButtons ? undefined : styles.deleteConfirmDeleteButton
          )}
          onClick={doCancel}
          disabled={disabled}>
          {onConfirm !== null ? cancelCta : cta}
        </button>
      )}
    />
  );

  return (
    <div className={styles.deleteConfirm}>
      <div className={styles.deleteConfirmTitle}>{title}</div>
      <div className={styles.deleteConfirmBody}>{body}</div>
      <div className={styles.deleteConfirmButtons}>
        {flipButtons ? (
          <>
            {cancelButton} {confirmButton}
          </>
        ) : (
          <>
            {confirmButton} {cancelButton}
          </>
        )}
      </div>
    </div>
  );
};
