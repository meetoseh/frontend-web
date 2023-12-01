import { ReactElement, useCallback, useContext, useEffect } from 'react';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { Feature } from '../../models/Feature';
import { ConfirmMergeAccount } from './ConfirmMergeAccount';
import { ConfirmMergeAccountResources } from './ConfirmMergeAccountResources';
import { ConfirmMergeAccountState, OauthMergeResult } from './ConfirmMergeAccountState';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useInappNotificationSessionValueWithCallbacks } from '../../../../shared/hooks/useInappNotificationSession';
import { LoginContext } from '../../../../shared/contexts/LoginContext';

const ianUid = 'oseh_ian_uKEDNejaLGNWKhDcgmHORg';

export const ConfirmMergeAccountFeature: Feature<
  ConfirmMergeAccountState,
  ConfirmMergeAccountResources
> = {
  identifier: 'confirmMergeAccount',
  useWorldState: () => {
    const loginContext = useContext(LoginContext);
    const mergeTokenVWC = useWritableValueWithCallbacks<string | null | undefined>(() => undefined);
    const resultVWC = useWritableValueWithCallbacks<OauthMergeResult | false | null | undefined>(
      () => null
    );
    const confirmResultVWC = useWritableValueWithCallbacks<boolean | null | undefined>(() => null);
    const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
    const promptingReviewReminderSettingsVWC = useWritableValueWithCallbacks(() => false);

    useEffect(() => {
      if (loginContext.state === 'logged-out') {
        console.log('logged out, clearing merge token');
        setVWC(mergeTokenVWC, null);
      }
    }, [loginContext.state, mergeTokenVWC]);

    useEffect(() => {
      if (mergeTokenVWC.get() !== undefined) {
        return;
      }

      const fragment = window.location.hash;
      if (fragment === '') {
        setVWC(mergeTokenVWC, null);
        return;
      }

      let args: URLSearchParams;
      try {
        args = new URLSearchParams(fragment.substring(1));
      } catch {
        setVWC(mergeTokenVWC, null);
        return;
      }
      if (!args.has('merge_token')) {
        setVWC(mergeTokenVWC, null);
        return;
      }
      const mergeToken = args.get('merge_token');
      if (mergeToken === null || mergeToken === '') {
        setVWC(mergeTokenVWC, null);
        return;
      }

      const urlWithoutHash = new URL(window.location.href);
      urlWithoutHash.hash = '';
      window.history.replaceState(null, '', urlWithoutHash.href);
      setVWC(mergeTokenVWC, mergeToken);
    }, [mergeTokenVWC]);

    const onShowingSecureLogin = useCallback(() => {
      console.log('showing secure login, setting merge token to undefined');
      setVWC(mergeTokenVWC, undefined);
    }, [mergeTokenVWC]);

    const onSecureLoginCompleted = useCallback(
      (mergeToken: string | null) => {
        console.log('secure login completed, setting merge token');
        setVWC(mergeTokenVWC, mergeToken);
      },
      [mergeTokenVWC]
    );

    const onFetchingInitialMergeResult = useCallback(() => {
      setVWC(resultVWC, undefined);
    }, [resultVWC]);

    const onInitialMergeResult = useCallback(
      (result: OauthMergeResult | false, error: ReactElement | null) => {
        setVWC(resultVWC, result);
        setVWC(errorVWC, error);
      },
      [resultVWC, errorVWC]
    );

    const onResolvingConflict = useCallback(() => {
      setVWC(confirmResultVWC, undefined);
    }, [confirmResultVWC]);

    const onResolveConflict = useCallback(
      (result: boolean, error: ReactElement | null) => {
        setVWC(confirmResultVWC, result);
        setVWC(errorVWC, error);
      },
      [confirmResultVWC, errorVWC]
    );

    const onDismissed = useCallback(() => {
      if (mergeTokenVWC.get() === null) {
        return;
      }

      const result = resultVWC.get();
      const confirmResult = confirmResultVWC.get();

      const justMerged =
        result !== false &&
        result !== null &&
        result !== undefined &&
        (result.result === 'trivialMerge' ||
          (result.result === 'confirmationRequired' && confirmResult === true));

      console.log('dismissed, setting merge token to null');
      setVWC(mergeTokenVWC, null);
      setVWC(promptingReviewReminderSettingsVWC, justMerged);
    }, [mergeTokenVWC, promptingReviewReminderSettingsVWC, confirmResultVWC, resultVWC]);

    const onReviewReminderSettingsPrompted = useCallback(() => {
      setVWC(promptingReviewReminderSettingsVWC, false);
    }, [promptingReviewReminderSettingsVWC]);

    return useMappedValuesWithCallbacks(
      [mergeTokenVWC, resultVWC, confirmResultVWC, errorVWC, promptingReviewReminderSettingsVWC],
      useCallback(
        (): ConfirmMergeAccountState => ({
          mergeToken: mergeTokenVWC.get(),
          promptingReviewReminderSettings: promptingReviewReminderSettingsVWC.get(),
          result: resultVWC.get(),
          confirmResult: confirmResultVWC.get(),
          error: errorVWC.get(),
          onShowingSecureLogin,
          onSecureLoginCompleted,
          onFetchingInitialMergeResult,
          onInitialMergeResult,
          onResolvingConflict,
          onResolveConflict,
          onDismissed,
          onReviewReminderSettingsPrompted,
        }),
        [
          mergeTokenVWC,
          resultVWC,
          promptingReviewReminderSettingsVWC,
          confirmResultVWC,
          errorVWC,
          onShowingSecureLogin,
          onSecureLoginCompleted,
          onFetchingInitialMergeResult,
          onInitialMergeResult,
          onResolvingConflict,
          onResolveConflict,
          onDismissed,
          onReviewReminderSettingsPrompted,
        ]
      )
    );
  },
  isRequired: (state) => {
    if (state.promptingReviewReminderSettings) {
      return true;
    }

    if (state.mergeToken === undefined) {
      return undefined;
    }

    return state.mergeToken !== null;
  },
  useResources: (state, required, allStates) => {
    const ianSession = useInappNotificationSessionValueWithCallbacks({
      type: 'callbacks',
      props: () => ({
        uid: required.get() ? ianUid : null,
      }),
      callbacks: required.callbacks,
    });

    const requestNotificationTimes = useCallback(() => {
      allStates.get().requestNotificationTime.setClientRequested(true);
    }, [allStates]);

    return useMappedValueWithCallbacks(
      ianSession,
      useCallback(
        (sess) => ({
          session: sess,
          loading: sess === null,
          requestNotificationTimes,
        }),
        [requestNotificationTimes]
      )
    );
  },
  component: (state, resources) => <ConfirmMergeAccount state={state} resources={resources} />,
};
