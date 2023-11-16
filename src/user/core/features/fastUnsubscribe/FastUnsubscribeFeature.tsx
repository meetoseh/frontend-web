import { useCallback, useContext } from 'react';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { Feature } from '../../models/Feature';
import { FastUnsubscribeResources, FastUnsubscribeVariant } from './FastUnsubscribeResources';
import { FastUnsubscribeState } from './FastUnsubscribeState';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { FastUnsubscribe } from './FastUnsubscribe';
import { useProviderUrlsValueWithCallbacks } from '../../../login/LoginApp';
import { DailyReminders, parseDailyReminders } from './FastUnsubscribeLoggedIn';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { apiFetch } from '../../../../shared/ApiConstants';
import { useValuesWithCallbacksEffect } from '../../../../shared/hooks/useValuesWithCallbacksEffect';

/**
 * The fast unsubscribe feature which allows a user to rapidly enable/disable
 * daily reminders on sms/email/push. This is reached by clicking an unsubscribe
 * link in an email.
 *
 * This has two variants; one for logged out users, which can unsubscribe an
 * email address without logging in, and one for logged in users, which allows
 * for more fine-grained control of the daily reminders. The logged out variant
 * ensures that users who forgot their login can easily unsubscribe from the email
 * list.
 */
export const FastUnsubscribeFeature: Feature<FastUnsubscribeState, FastUnsubscribeResources> = {
  identifier: 'fastUnsubscribe',
  useWorldState: () => {
    return useWritableValueWithCallbacks<FastUnsubscribeState>(() => ({}));
  },
  isRequired: (state, allStates) => {
    if (allStates.touchLink.code === null) {
      return false;
    }

    if (allStates.touchLink.linkInfo === undefined) {
      return undefined;
    }

    if (allStates.touchLink.linkInfo === null) {
      return false;
    }

    return allStates.touchLink.linkInfo.pageIdentifier === 'unsubscribe';
  },
  useResources: (state, required, allStates) => {
    const loginContext = useContext(LoginContext);
    const variantVWC = useWritableValueWithCallbacks<FastUnsubscribeVariant | null | undefined>(
      () => undefined
    );
    const codeVWC = useMappedValueWithCallbacks(allStates, (s) => s.touchLink.code);
    const [signinUrlsVWC, signinUrlsErrorVWC] = useProviderUrlsValueWithCallbacks(required);
    const onDismissVWC = useMappedValueWithCallbacks(allStates, (s) => s.touchLink.handledLink);
    const dailyRemindersVWC = useWritableValueWithCallbacks<DailyReminders | undefined>(
      () => undefined
    );

    const dismissAndGotoSettingsVWC = useMappedValueWithCallbacks(allStates, (s) => () => {
      s.settings.setShow(true, true);
      s.touchLink.handledLink();
    });

    useValuesWithCallbacksEffect(
      [required, codeVWC],
      useCallback(() => {
        const req = required.get();
        const code = codeVWC.get();

        if (!req || code === null || loginContext.state === 'loading') {
          setVWC(variantVWC, undefined);
          return;
        }

        if (loginContext.state === 'logged-out') {
          setVWC(variantVWC, 'logged-out');
          return;
        }

        setVWC(variantVWC, 'logged-in');
        return undefined;
      }, [loginContext, variantVWC, codeVWC, required])
    );

    useValueWithCallbacksEffect(
      variantVWC,
      useCallback(
        (variant) => {
          if (variant !== 'logged-in') {
            setVWC(dailyRemindersVWC, undefined);
            return undefined;
          }

          let running = true;
          fetchDailyReminders();
          return () => {
            running = false;
          };

          async function fetchDailyRemindersInner() {
            const response = await apiFetch(
              '/api/1/users/me/daily_reminders',
              { method: 'GET' },
              loginContext
            );
            if (!response.ok) {
              throw response;
            }
            const raw = await response.json();
            const parsed = parseDailyReminders(raw);
            if (running) {
              setVWC(dailyRemindersVWC, parsed);
            }
          }

          async function fetchDailyReminders() {
            try {
              await fetchDailyRemindersInner();
            } catch (e) {
              console.error('failed to fetch daily reminders:', e);
            }
          }
        },
        [dailyRemindersVWC, loginContext]
      )
    );

    return useMappedValuesWithCallbacks(
      [
        variantVWC,
        signinUrlsVWC,
        signinUrlsErrorVWC,
        codeVWC,
        onDismissVWC,
        dailyRemindersVWC,
        dismissAndGotoSettingsVWC,
      ],
      (): FastUnsubscribeResources => {
        const variant = variantVWC.get();
        const code = codeVWC.get();
        const socialUrls = signinUrlsVWC.get();
        const socialUrlsError = signinUrlsErrorVWC.get();
        const onDismiss = onDismissVWC.get();
        const dailyReminders = dailyRemindersVWC.get();
        const dismissAndGotoSettings = dismissAndGotoSettingsVWC.get();

        if (variant === undefined) {
          return {
            variant: undefined,
            socialUrls: undefined,
            socialUrlsError: undefined,
            dailyReminders: undefined,
            code: undefined,
            onDismiss: () => {},
            dismissAndGotoSettings: () => {},
            loading: true,
          };
        }

        return {
          variant,
          code: code ?? undefined,
          socialUrls,
          socialUrlsError:
            socialUrls === null && socialUrlsError === null ? undefined : socialUrlsError,
          dailyReminders,
          onDismiss,
          dismissAndGotoSettings,
          loading:
            code === undefined ||
            (socialUrls === null && socialUrlsError === null) ||
            (variant === 'logged-in' && dailyReminders === undefined),
        };
      }
    );
  },
  component: (state, resources) => <FastUnsubscribe state={state} resources={resources} />,
};
