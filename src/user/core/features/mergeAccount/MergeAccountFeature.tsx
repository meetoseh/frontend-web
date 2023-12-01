import { useCallback, useContext, useEffect } from 'react';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { Feature } from '../../models/Feature';
import { MergeAccount } from './MergeAccount';
import { MergeAccountResources } from './MergeAccountResources';
import { MergeAccountState, MergeProvider } from './MergeAccountState';
import {
  MergeAccountStoredState,
  getMergeAccountStoredState,
  setMergeAccountStoredState,
} from './MergeAccountStore';
import { useInappNotificationValueWithCallbacks } from '../../../../shared/hooks/useInappNotification';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { apiFetch } from '../../../../shared/ApiConstants';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { useInappNotificationSessionValueWithCallbacks } from '../../../../shared/hooks/useInappNotificationSession';
import { getMergeProviderUrl } from './utils';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';

const recheckMergeSuggestionsIntervalSeconds = 60 * 60 * 12;
const ianUid = 'oseh_ian_ez6eLf92Lbz1Odr6OKIw6A';

export const MergeAccountFeature: Feature<MergeAccountState, MergeAccountResources> = {
  identifier: 'mergeAccount',
  useWorldState: () => {
    const mergeAccountStoredStateVWC =
      useWritableValueWithCallbacks<MergeAccountStoredState | null>(() => null);
    const erroredVWC = useWritableValueWithCallbacks<boolean>(() => false);
    const ianPropsVWC = useMappedValuesWithCallbacks(
      [mergeAccountStoredStateVWC, erroredVWC],
      useCallback(() => {
        const stored = mergeAccountStoredStateVWC.get();
        if (stored === null || stored === undefined) {
          return { uid: ianUid, suppress: true };
        }

        const errored = erroredVWC.get();
        if (errored) {
          return { uid: ianUid, suppress: true };
        }

        return { uid: ianUid, suppress: false };
      }, [mergeAccountStoredStateVWC, erroredVWC])
    );
    const ianVWC = useInappNotificationValueWithCallbacks({
      type: 'callbacks',
      props: ianPropsVWC.get,
      callbacks: ianPropsVWC.callbacks,
    });
    const loginContext = useContext(LoginContext);

    useEffect(() => {
      if (loginContext.state !== 'logged-in') {
        setVWC(mergeAccountStoredStateVWC, null);
        return;
      }

      if (erroredVWC.get()) {
        return;
      }

      let running = true;
      readStateAndMaybeFetchFromServer();
      return () => {
        running = false;
      };

      async function readStateFromServer(): Promise<MergeAccountStoredState> {
        if (loginContext.userAttributes === null) {
          throw new Error('User attributes not loaded');
        }

        const response = await apiFetch(
          '/api/1/users/me/merge_account_suggestions',
          { method: 'GET' },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        if (response.status === 204) {
          return {
            mergeSuggestions: null,
            checkedAt: new Date(),
            userSub: loginContext.userAttributes.sub,
          };
        }

        const body: { channels: MergeProvider[] } = await response.json();
        return {
          mergeSuggestions: body.channels.map((provider) => ({ provider })),
          checkedAt: new Date(),
          userSub: loginContext.userAttributes.sub,
        };
      }

      async function readStateAndMaybeFetchFromServer() {
        const stored = await getMergeAccountStoredState();
        if (!running) {
          return;
        }

        if (
          stored !== null &&
          stored.checkedAt.getTime() > Date.now() - recheckMergeSuggestionsIntervalSeconds * 1000 &&
          stored.userSub === loginContext.userAttributes?.sub
        ) {
          setVWC(mergeAccountStoredStateVWC, stored);
          return;
        }

        let fromServer;
        try {
          fromServer = await readStateFromServer();
        } catch (e) {
          if (!running) {
            return;
          }

          setVWC(erroredVWC, true);
          return;
        }

        if (!running) {
          return;
        }

        await setMergeAccountStoredState(fromServer);
        setVWC(mergeAccountStoredStateVWC, fromServer);
        setVWC(erroredVWC, false);
      }
    }, [mergeAccountStoredStateVWC, erroredVWC, loginContext]);

    return useMappedValuesWithCallbacks(
      [mergeAccountStoredStateVWC, erroredVWC, ianVWC],
      useCallback((): MergeAccountState => {
        if (loginContext.state !== 'logged-in') {
          return {
            mergeSuggestions: null,
            ian: null,
            onSuggestionsDismissed: () => Promise.resolve(),
          };
        }
        const stored = mergeAccountStoredStateVWC.get();
        const errored = erroredVWC.get();
        const ian = ianVWC.get();
        return {
          mergeSuggestions: errored ? null : stored?.mergeSuggestions,
          ian,
          onSuggestionsDismissed: async () => {
            if (loginContext.state !== 'logged-in' || loginContext.userAttributes === null) {
              await setMergeAccountStoredState(null);
              setVWC(mergeAccountStoredStateVWC, null);
              return;
            }

            const newStored: MergeAccountStoredState = {
              mergeSuggestions: null,
              checkedAt: new Date(),
              userSub: loginContext.userAttributes.sub,
            };
            await setMergeAccountStoredState(newStored);
            setVWC(mergeAccountStoredStateVWC, newStored);
          },
        };
      }, [mergeAccountStoredStateVWC, erroredVWC, ianVWC, loginContext])
    );
  },
  isRequired: (state) => {
    if (state.mergeSuggestions === undefined) {
      return undefined;
    }

    if (state.mergeSuggestions === null) {
      return false;
    }

    if (state.ian === null) {
      return undefined;
    }

    return state.ian.showNow;
  },
  useResources: (stateVWC, requiredVWC, allStatesVWC) => {
    const sessionPropsVWC = useMappedValuesWithCallbacks(
      [stateVWC, requiredVWC],
      useCallback(() => {
        const ian = stateVWC.get().ian;
        if (!requiredVWC.get() || ian === null) {
          return { uid: null };
        }
        return { uid: ian.uid };
      }, [stateVWC, requiredVWC])
    );
    const sessionVWC = useInappNotificationSessionValueWithCallbacks({
      type: 'callbacks',
      props: sessionPropsVWC.get,
      callbacks: sessionPropsVWC.callbacks,
    });

    const loginContext = useContext(LoginContext);
    const givenName = loginContext.userAttributes?.givenName ?? null;

    const providerUrlsVWC = useWritableValueWithCallbacks<{
      Google: string | null;
      SignInWithApple: string | null;
      Direct: string | null;
      Dev: string | null;
    } | null>(() => null);

    useMappedValuesWithCallbacks(
      [stateVWC, requiredVWC],
      useCallback(() => {
        let running = true;
        inner();
        return () => {
          running = false;
        };

        async function inner() {
          if (!requiredVWC.get()) {
            setVWC(providerUrlsVWC, null);
            return;
          }

          const state = stateVWC.get();
          if (
            state.mergeSuggestions === null ||
            state.mergeSuggestions === undefined ||
            state.mergeSuggestions.length === 0
          ) {
            setVWC(providerUrlsVWC, null);
            return;
          }

          const urls: MergeAccountResources['providerUrls'] = {
            Google: null,
            SignInWithApple: null,
            Direct: null,
            Dev: null,
          };
          let gotAtLeastOne = false;
          const promises = state.mergeSuggestions.map(async (suggestion) => {
            const url = await getMergeProviderUrl(loginContext, suggestion.provider);
            urls[suggestion.provider] = url;
            gotAtLeastOne = true;
          });
          await Promise.allSettled(promises);
          if (!running) {
            return;
          }

          if (!gotAtLeastOne) {
            state.onSuggestionsDismissed();
            return;
          }

          setVWC(providerUrlsVWC, urls);
        }
      }, [stateVWC, requiredVWC, loginContext, providerUrlsVWC])
    );

    const confirmMergePassthroughsVWC = useMappedValueWithCallbacks(
      allStatesVWC,
      (allStates) => {
        const onShowingSecureLogin = allStates.confirmMergeAccount.onShowingSecureLogin;
        const onSecureLoginCompleted = allStates.confirmMergeAccount.onSecureLoginCompleted;

        return {
          onShowingSecureLogin,
          onSecureLoginCompleted,
        };
      },
      {
        inputEqualityFn: (a, b) => {
          return (
            Object.is(
              a.confirmMergeAccount.onShowingSecureLogin,
              b.confirmMergeAccount.onShowingSecureLogin
            ) &&
            Object.is(
              a.confirmMergeAccount.onSecureLoginCompleted,
              b.confirmMergeAccount.onSecureLoginCompleted
            )
          );
        },
      }
    );

    return useMappedValuesWithCallbacks(
      [sessionVWC, providerUrlsVWC, confirmMergePassthroughsVWC, requiredVWC],
      useCallback((): MergeAccountResources => {
        const confirmMergePassthroughs = confirmMergePassthroughsVWC.get();

        if (!requiredVWC.get()) {
          return {
            session: null,
            givenName: null,
            providerUrls: null,
            loading: true,
            ...confirmMergePassthroughs,
          };
        }

        const session = sessionVWC.get();
        const providerUrls = providerUrlsVWC.get();

        return {
          session,
          givenName,
          providerUrls,
          loading: session === null || providerUrls === null,
          ...confirmMergePassthroughs,
        };
      }, [requiredVWC, sessionVWC, providerUrlsVWC, confirmMergePassthroughsVWC, givenName])
    );
  },
  component: (state, resources) => <MergeAccount state={state} resources={resources} />,
};
