import { useCallback } from 'react';
import { LoginContextValue } from '../../../../../shared/contexts/LoginContext';
import {
  ModalContextValue,
  addModalWithCallbackToRemove,
} from '../../../../../shared/contexts/ModalContext';
import {
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { useValueWithCallbacksEffect } from '../../../../../shared/hooks/useValueWithCallbacksEffect';
import { YesNoModal } from '../../../../../shared/components/YesNoModal';
import { useValuesWithCallbacksEffect } from '../../../../../shared/hooks/useValuesWithCallbacksEffect';
import { DisplayableError } from '../../../../../shared/lib/errors';

export const useHandleDeleteAccount = (
  loginContextRaw: LoginContextValue,
  modalContext: ModalContextValue,
  errorVWC: WritableValueWithCallbacks<DisplayableError | null>
): (() => void) => {
  const showDeleteConfirmInitialPromptVWC = useWritableValueWithCallbacks(() => false);
  const showDeleteConfirmApplePromptVWC = useWritableValueWithCallbacks(() => false);
  const showDeleteConfirmGooglePromptVWC = useWritableValueWithCallbacks(() => false);
  const showDeleteConfirmStripePromptVWC = useWritableValueWithCallbacks(() => false);
  const showDeleteConfirmPromoPromptVWC = useWritableValueWithCallbacks(() => false);

  const deleteAccount = useCallback(
    async (force: boolean): Promise<void> => {
      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        setVWC(
          errorVWC,
          new DisplayableError('server-refresh-required', 'delete account', 'not logged in')
        );
        return;
      }
      const loginContext = loginContextUnch;

      try {
        let response;
        try {
          response = await apiFetch(
            `/api/1/users/me/account?${new URLSearchParams({ force: force ? '1' : '0' })}`,
            {
              method: 'DELETE',
            },
            loginContext
          );
        } catch {
          throw new DisplayableError('connectivity', 'delete account');
        }

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
              setVWC(
                errorVWC,
                new DisplayableError(
                  'client',
                  'delete account',
                  `unknown conflict type: ${body.type}`
                )
              );
              return;
            }
          }
          throw response;
        }

        await loginContextRaw.setAuthTokens(null);
        window.location.href = '/';
      } catch (e) {
        console.error(e);
        const err =
          e instanceof DisplayableError
            ? e
            : new DisplayableError('client', 'delete account', `${e}`);
        setVWC(errorVWC, err);
      }
    },
    [
      loginContextRaw,
      errorVWC,
      showDeleteConfirmApplePromptVWC,
      showDeleteConfirmGooglePromptVWC,
      showDeleteConfirmPromoPromptVWC,
      showDeleteConfirmStripePromptVWC,
    ]
  );

  useValuesWithCallbacksEffect([showDeleteConfirmInitialPromptVWC, loginContextRaw.value], () => {
    const showDeleteConfirmInitialPrompt = showDeleteConfirmInitialPromptVWC.get();
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
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

    const requestDismiss = createWritableValueWithCallbacks<() => void>(() => {});
    const onCancel = async () => setVWC(showDeleteConfirmInitialPromptVWC, false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <YesNoModal
        title="Are you sure you want to delete your account?"
        body={
          'By deleting your account, all your progress and history will be permanently lost. If ' +
          'you have a subscription, we recommend you manually unsubscribe prior to deleting ' +
          'your account.'
        }
        cta1="Not Now"
        cta2="Delete"
        onClickOne={async () => requestDismiss.get()()}
        onClickTwo={onDelete}
        emphasize={2}
        onDismiss={onCancel}
        requestDismiss={requestDismiss}
      />
    );
  });

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

    const requestDismiss = createWritableValueWithCallbacks<() => void>(() => {});
    const onCancel = () => setVWC(showDeleteConfirmApplePromptVWC, false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <YesNoModal
        title="To unsubscribe from Oseh+"
        body="Visit the App Store > Settings > Subscriptions > Oseh > Cancel subscription."
        cta1="Cancel"
        cta2="Delete my account"
        onClickOne={async () => requestDismiss.get()()}
        onClickTwo={onDelete}
        emphasize={2}
        onDismiss={onCancel}
        requestDismiss={requestDismiss}
      />
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

    const requestDismiss = createWritableValueWithCallbacks<() => void>(() => {});
    const onCancel = () => setVWC(showDeleteConfirmGooglePromptVWC, false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <YesNoModal
        title="To unsubscribe from Oseh+"
        body={
          'Open the Google Play app, at the top right, tap the profile icon, tap Payments & ' +
          'subscriptions > Subscriptions, select the subcription you want to cancel, tap ' +
          'Cancel subscription, and follow the instructions.'
        }
        cta1="Cancel"
        cta2="Delete my account"
        onClickOne={async () => requestDismiss.get()()}
        onClickTwo={onDelete}
        emphasize={2}
        onDismiss={onCancel}
        requestDismiss={requestDismiss}
      />
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

    const requestDismiss = createWritableValueWithCallbacks<() => void>(() => {});
    const onCancel = () => setVWC(showDeleteConfirmStripePromptVWC, false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <YesNoModal
        title="Are you sure you want to cancel your subscription?"
        body="By unsubscribing, you will lose access to Oseh+."
        cta1="Cancel"
        cta2="Unsubscribe and Delete Account"
        onClickOne={async () => requestDismiss.get()()}
        onClickTwo={onDelete}
        emphasize={2}
        onDismiss={onCancel}
        requestDismiss={requestDismiss}
      />
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

    const requestDismiss = createWritableValueWithCallbacks<() => void>(() => {});
    const onCancel = () => setVWC(showDeleteConfirmPromoPromptVWC, false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <YesNoModal
        title="You do not have an active subscription."
        body="You were gifted free access and are currently not being charged."
        cta1="Cancel"
        cta2="Delete my account"
        onClickOne={async () => requestDismiss.get()()}
        onClickTwo={onDelete}
        emphasize={2}
        onDismiss={onCancel}
        requestDismiss={requestDismiss}
      />
    );
  });

  return useCallback(() => {
    setVWC(showDeleteConfirmInitialPromptVWC, true);
  }, [showDeleteConfirmInitialPromptVWC]);
};
