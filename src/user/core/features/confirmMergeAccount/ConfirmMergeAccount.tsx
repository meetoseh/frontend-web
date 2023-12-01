import { ReactElement, useCallback, useContext, useEffect, useRef } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { ConfirmMergeAccountResources } from './ConfirmMergeAccountResources';
import { ConfirmMergeAccountState, oauthMergeResultKeyMap } from './ConfirmMergeAccountState';
import { useStartSession } from '../../../../shared/hooks/useInappNotificationSession';
import { Buffer } from 'buffer';
import { describeError } from '../../../../shared/forms/ErrorBlock';
import { apiFetch } from '../../../../shared/ApiConstants';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { convertUsingKeymap } from '../../../../admin/crud/CrudFetcher';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { SplashScreen } from '../../../splash/SplashScreen';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { NoChangeRequired } from './components/NoChangeRequired';
import { CreatedAndAttached } from './components/CreatedAndAttached';
import { TrivialMerge } from './components/TrivialMerge';
import { ConfirmationRequired } from './components/ConfirmationRequired';
import { ConfirmFinish } from './components/ConfirmFinish';
import { ContactSupport } from './components/ContactSupport';
import { ReviewReminders } from './components/ReviewReminders';

export const ConfirmMergeAccount = ({
  resources,
  state,
}: FeatureComponentProps<ConfirmMergeAccountState, ConfirmMergeAccountResources>): ReactElement => {
  const loginContext = useContext(LoginContext);

  useStartSession(
    {
      type: 'callbacks',
      props: () => resources.get().session,
      callbacks: resources.callbacks,
    },
    {
      onStart: () => {
        let tokenOriginalUserSub: string | null = null;
        let provider: string | null = null;
        let providerSub: string | null = null;

        try {
          const mergeToken = state.get().mergeToken;
          if (mergeToken !== null && mergeToken !== undefined) {
            const payloadBase64 = mergeToken.split('.')[1];
            const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
            const payload = JSON.parse(payloadJson);
            tokenOriginalUserSub = payload.sub ?? null;
            provider = payload['oseh:provider'] ?? null;
            providerSub = (payload['oseh:provider_claims'] ?? {})['sub'] ?? null;
          }
        } catch (e) {
          console.log('error getting merge token debug information:', e);
        }

        resources.get().session?.storeAction('open', {
          token_original_user_sub: tokenOriginalUserSub,
          provider,
          provider_sub: providerSub,
        });
      },
    }
  );

  const triedStartMerge = useRef(false);
  useEffect(() => {
    if (
      triedStartMerge.current ||
      loginContext.state !== 'logged-in' ||
      state.get().result !== null
    ) {
      return;
    }

    triedStartMerge.current = true;
    tryStartMerge();
    return undefined;

    async function tryStartMergeInner() {
      const mergeToken = state.get().mergeToken;
      if (mergeToken === null || mergeToken === undefined) {
        throw new Error('merge token is null or undefined');
      }

      const response = await apiFetch(
        '/api/1/oauth/merge/start',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            merge_token: mergeToken,
          }),
        },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      const raw = await response.json();
      const parsed = convertUsingKeymap(raw, oauthMergeResultKeyMap);
      resources.get().session?.storeAction('start', {
        ...parsed,
        conflictDetails:
          parsed.conflictDetails === null || parsed.conflictDetails === undefined
            ? null
            : {
                ...parsed.conflictDetails,
                mergeJwt: 'REDACTED',
              },
      });
      state.get().onInitialMergeResult(parsed, null);
    }

    async function tryStartMerge() {
      state.get().onFetchingInitialMergeResult();
      try {
        await tryStartMergeInner();
      } catch (e) {
        console.log('error starting merge:', e);
        const error = await describeError(e);
        resources.get().session?.storeAction('start', {
          error: e instanceof Response ? `${e.status}: ${e.statusText}` : `${e}`,
        });
        state.get().onInitialMergeResult(false, error);
      }
    }
  }, [state, resources, loginContext]);

  const screen = useMappedValueWithCallbacks(
    state,
    (state) => {
      if (state.promptingReviewReminderSettings) {
        return 'reviewReminderSettings';
      }

      if (
        state.result === undefined ||
        state.result === null ||
        state.confirmResult === undefined
      ) {
        return 'splash';
      }

      if (state.result === false || state.confirmResult === false || state.error !== null) {
        return 'contactSupport';
      }

      if (state.result.result !== 'confirmationRequired') {
        return state.result.result;
      }

      if (state.confirmResult === null) {
        return 'confirmationRequired';
      }

      if (state.confirmResult) {
        return 'confirmFinish';
      }

      return 'contactSupport';
    },
    {
      outputEqualityFn: (a, b) => a === b,
    }
  );

  useValueWithCallbacksEffect(
    screen,
    useCallback(
      (screen) => {
        if (screen === 'noChangeRequired') {
          resources.get().session?.storeAction('no_change_required', null);
        } else if (screen === 'createdAndAttached') {
          resources.get().session?.storeAction('created_and_attached', null);
        } else if (screen === 'trivialMerge') {
          resources.get().session?.storeAction('trivial_merge', null);
        } else if (screen === 'confirmationRequired') {
          resources.get().session?.storeAction('confirmation_required', null);
        } else if (screen === 'confirmFinish') {
          resources.get().session?.storeAction('confirm_finish', null);
        } else if (screen === 'reviewReminderSettings') {
          resources.get().session?.storeAction('review_notifications', null);
        } else if (screen !== 'splash') {
          resources.get().session?.storeAction('contact_support', null);
        }
        return undefined;
      },
      [resources]
    )
  );

  return (
    <RenderGuardedComponent
      props={screen}
      component={(screen) => {
        if (screen === 'noChangeRequired') {
          return <NoChangeRequired state={state} resources={resources} />;
        } else if (screen === 'createdAndAttached') {
          return <CreatedAndAttached state={state} resources={resources} />;
        } else if (screen === 'trivialMerge') {
          return <TrivialMerge state={state} resources={resources} />;
        } else if (screen === 'confirmationRequired') {
          return <ConfirmationRequired state={state} resources={resources} />;
        } else if (screen === 'confirmFinish') {
          return <ConfirmFinish state={state} resources={resources} />;
        } else if (screen === 'reviewReminderSettings') {
          return <ReviewReminders state={state} resources={resources} />;
        } else if (screen === 'splash') {
          return <SplashScreen />;
        } else {
          return <ContactSupport state={state} resources={resources} />;
        }
      }}
    />
  );
};
