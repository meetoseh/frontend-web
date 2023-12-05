import { ReactElement, useCallback } from 'react';
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
import { useValueWithCallbacksEffect } from '../../../../../shared/hooks/useValueWithCallbacksEffect';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { describeErrorFromResponse } from '../../../../../shared/forms/ErrorBlock';
import { YesNoModal } from '../../../../../shared/components/YesNoModal';

export const useHandleCancelSubscription = (
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

    const requestDismiss = createWritableValueWithCallbacks<() => void>(() => {});
    const onCancel = () => setVWC(showCancelInitialPromptVWC, false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <YesNoModal
        title="Are you sure you want to unsubscribe from Oseh+?"
        body="By unsubscribing, you will lose access to Oseh+."
        cta1="Not Now"
        cta2="Unsubscribe"
        onClickOne={async () => requestDismiss.get()()}
        onClickTwo={tryCancel}
        onDismiss={onCancel}
        emphasize={2}
        requestDismiss={requestDismiss}
      />
    );
  });

  useValueWithCallbacksEffect(showCancelApplePromptVWC, (showCancelApplePrompt) => {
    if (!showCancelApplePrompt) {
      return;
    }

    const requestDismiss = createWritableValueWithCallbacks<() => void>(() => {});
    const onCancel = () => setVWC(showCancelApplePromptVWC, false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <YesNoModal
        title="To unsubscribe from Oseh+"
        body="Visit the App Store > Settings > Subscriptions > Oseh > Cancel subscription."
        cta1="Okay"
        onClickOne={async () => requestDismiss.get()()}
        onDismiss={onCancel}
        emphasize={1}
        requestDismiss={requestDismiss}
      />
    );
  });

  useValueWithCallbacksEffect(showCancelPromoPromptVWC, (showCancelPromoPrompt) => {
    if (!showCancelPromoPrompt) {
      return;
    }

    const requestDismiss = createWritableValueWithCallbacks<() => void>(() => {});
    const onCancel = () => setVWC(showCancelPromoPromptVWC, false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <YesNoModal
        title="You do not have an active subscription."
        body="You were gifted free access and are currently not being charged."
        cta1="Okay"
        onClickOne={async () => requestDismiss.get()()}
        onDismiss={onCancel}
        emphasize={1}
        requestDismiss={requestDismiss}
      />
    );
  });

  useValueWithCallbacksEffect(
    showCancelNoSubscriptionPromptVWC,
    (showCancelNoSubscriptionPrompt) => {
      if (!showCancelNoSubscriptionPrompt) {
        return;
      }

      const requestDismiss = createWritableValueWithCallbacks<() => void>(() => {});
      const onCancel = () => setVWC(showCancelNoSubscriptionPromptVWC, false);

      return addModalWithCallbackToRemove(
        modalContext.modals,
        <YesNoModal
          title="You’ve already cancelled your subscription to Oseh+"
          body={
            'You do not have a recurring subscription. Access will end after your ' +
            'current billing period.'
          }
          cta1="Okay"
          onClickOne={async () => requestDismiss.get()()}
          onDismiss={onCancel}
          emphasize={1}
          requestDismiss={requestDismiss}
        />
      );
    }
  );

  useValueWithCallbacksEffect(showCancelSuccessPromptVWC, (showCancelSuccessPrompt) => {
    if (!showCancelSuccessPrompt) {
      return;
    }

    const requestDismiss = createWritableValueWithCallbacks<() => void>(() => {});
    const onCancel = () => setVWC(showCancelSuccessPromptVWC, false);

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <YesNoModal
        title="You are no longer subscribed to Oseh+."
        body="You will not be charged for Oseh+ unless you resubscribe."
        cta1="Okay"
        onClickOne={async () => requestDismiss.get()()}
        onDismiss={onCancel}
        emphasize={1}
        requestDismiss={requestDismiss}
      />
    );
  });

  return useCallback(() => {
    setVWC(showCancelInitialPromptVWC, true);
  }, [showCancelInitialPromptVWC]);
};
