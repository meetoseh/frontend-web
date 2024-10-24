import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { LoginContextValueLoggedIn } from '../../../../shared/contexts/LoginContext';
import { createValuesWithCallbacksEffect } from '../../../../shared/hooks/createValuesWithCallbacksEffect';
import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { Visitor } from '../../../../shared/hooks/useVisitorValueWithCallbacks';
import {
  createWritableValueWithCallbacks,
  ValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../shared/lib/CancelablePromise';
import { DisplayableError } from '../../../../shared/lib/errors';
import { getCurrentServerTimeMS } from '../../../../shared/lib/getCurrentServerTimeMS';
import { mapCancelable } from '../../../../shared/lib/mapCancelable';
import { setVWC } from '../../../../shared/lib/setVWC';
import { waitForValueWithCallbacksConditionCancelable } from '../../../../shared/lib/waitForValueWithCallbacksCondition';
import { RequestResult, Result } from '../../../../shared/requests/RequestHandler';
import { unwrapRequestResult } from '../../../../shared/requests/unwrapRequestResult';
import { OsehScreen } from '../../models/Screen';
import { screenConfigurableTriggerMapper } from '../../models/ScreenConfigurableTrigger';
import {
  JournalEntryMetadata,
  JournalEntryMetadataRef,
} from '../journal_chat/lib/createJournalEntryMetadataRequestHandler';
import { JournalChatState } from '../journal_chat/lib/JournalChatState';
import { JournalEntryView } from './JournalEntryView';
import { JournalEntryViewAPIParams, JournalEntryViewMappedParams } from './JournalEntryViewParams';
import { JournalEntryViewResources } from './JournalEntryViewResources';
import * as JEStateMachine from '../journal_chat/lib/createJournalEntryStateMachine';
import { JournalEntryStateMachineRef } from '../journal_chat/lib/createJournalEntryStateMachineRequestHandler';
import { createMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';

/**
 * Allows the user to view, but not edit, an existing journal entry
 */
export const JournalEntryViewScreen: OsehScreen<
  'journal_entry_view',
  JournalEntryViewResources,
  JournalEntryViewAPIParams,
  JournalEntryViewMappedParams
> = {
  slug: 'journal_entry_view',
  paramMapper: (api) => ({
    entrance: api.entrance,
    header: api.header,
    journalEntry: api.journal_entry,
    cta: {
      text: api.cta.text,
      trigger: convertUsingMapper(api.cta.trigger, screenConfigurableTriggerMapper),
      exit: api.cta.exit,
    },
    close: {
      variant: api.close.variant,
      trigger: convertUsingMapper(api.close.trigger, screenConfigurableTriggerMapper),
      exit: api.close.exit,
    },
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const activeVWC = createWritableValueWithCallbacks(true);

    const getJournalEntryManager = (): RequestResult<JEStateMachine.JournalEntryStateMachine> => {
      return ctx.resources.journalEntryStateMachineHandler.request({
        ref: {
          journalEntryUID: screen.parameters.journalEntry.uid,
          journalEntryJWT: screen.parameters.journalEntry.jwt,
        },
        refreshRef: (): CancelablePromise<Result<JournalEntryStateMachineRef>> => {
          if (!activeVWC.get()) {
            return {
              promise: Promise.resolve({
                type: 'expired',
                data: undefined,
                error: new DisplayableError('server-refresh-required', 'refresh journal'),
                retryAt: undefined,
              }),
              done: () => true,
              cancel: () => {},
            };
          }

          return mapCancelable(
            refreshScreen(),
            (s): Result<JournalEntryStateMachineRef> =>
              s.type !== 'success'
                ? s
                : s.data.parameters.journalEntry === null
                ? {
                    type: 'error',
                    data: undefined,
                    error: new DisplayableError('server-refresh-required', 'refresh journal'),
                    retryAt: undefined,
                  }
                : {
                    type: 'success',
                    data: {
                      journalEntryUID: s.data.parameters.journalEntry.uid,
                      journalEntryJWT: s.data.parameters.journalEntry.jwt,
                    },
                    error: undefined,
                    retryAt: undefined,
                  }
          );
        },
      });
    };

    const journalEntryManagerVWC =
      createWritableValueWithCallbacks<RequestResult<JEStateMachine.JournalEntryStateMachine> | null>(
        null
      );
    const cleanupJournalEntryManagerRequester = (() => {
      const request = getJournalEntryManager();
      setVWC(journalEntryManagerVWC, request);
      return () => {
        if (Object.is(journalEntryManagerVWC.get(), request)) {
          setVWC(journalEntryManagerVWC, null);
        }
        request.release();
      };
    })();
    const [journalEntryManagerUnwrappedVWC, cleanupJournalEntryManagerUnwrapper] =
      unwrapRequestResult(
        journalEntryManagerVWC,
        (d) => d.data,
        () => null
      );

    const [journalEntryStateUnwrappedVWC, cleanupJournalEntryStateUnwrapper] = (() => {
      const result = createWritableValueWithCallbacks<JEStateMachine.State | null>(null);
      const cleanup = createValueWithCallbacksEffect(journalEntryManagerUnwrappedVWC, (d) => {
        if (d === null) {
          setVWC(result, null);
          return undefined;
        }

        return createValueWithCallbacksEffect(d.state, (s) => {
          setVWC(result, s);
          return undefined;
        });
      });
      return [result, cleanup];
    })();

    const [journalEntryJWTVWC, cleanupJournalEntryJWTUnwrapper] = createMappedValueWithCallbacks(
      journalEntryStateUnwrappedVWC,
      (d) =>
        d !== null && d.type !== 'released' && d.type !== 'error' ? d.journalEntryRef.jwt : null
    );
    const [chatWrappedVWC, cleanupChatWrappedUnwrapper] = createMappedValueWithCallbacks(
      journalEntryStateUnwrappedVWC,
      (d): ValueWithCallbacks<JournalChatState> | null | undefined => {
        if (d === null) {
          return null;
        }
        if (d.type === 'error' || d.type === 'released') {
          return undefined;
        }
        if (
          d.type === 'initializing' ||
          d.type === 'preparing-references' ||
          d.type === 'preparing-client-key' ||
          d.type === 'authorizing'
        ) {
          return null;
        }
        return d.value.displayable;
      }
    );
    const [chatVWC, cleanupChatUnwrapper] = (() => {
      const result = createWritableValueWithCallbacks<JournalChatState | null | undefined>(null);
      const cleanup = createValueWithCallbacksEffect(chatWrappedVWC, (d) => {
        if (d === undefined) {
          setVWC(result, undefined);
          return undefined;
        }
        if (d === null) {
          setVWC(result, null);
          return undefined;
        }
        return createValueWithCallbacksEffect(d, (s) => {
          setVWC(result, s);
          return undefined;
        });
      });
      return [result, cleanup];
    })();

    const cleanupJournalEntryManagerRefresher = createValuesWithCallbacksEffect(
      [
        journalEntryManagerVWC,
        journalEntryManagerUnwrappedVWC,
        ctx.login.value,
        ctx.interests.visitor.value,
      ],
      () => {
        const requestRaw = journalEntryManagerVWC.get();
        if (requestRaw === null) {
          return;
        }
        const request = requestRaw.data;
        const active = createWritableValueWithCallbacks(true);
        handle();
        return () => {
          setVWC(active, false);
        };

        async function handle() {
          if (!active.get()) {
            return;
          }
          const d = journalEntryManagerUnwrappedVWC.get();

          if (d === null) {
            return undefined;
          }

          const nowServer = await getCurrentServerTimeMS();
          if (!active.get()) {
            return;
          }

          if (JEStateMachine.isExpiredOrDisposed(d, nowServer)) {
            const raw = request.get();
            if (raw.type === 'success') {
              raw.reportExpired();
            }
            return;
          }
        }
      }
    );

    const getJournalEntryMetadata = (
      user: LoginContextValueLoggedIn,
      visitor: Visitor,
      jwt: string
    ): RequestResult<JournalEntryMetadata> => {
      return ctx.resources.journalEntryMetadataHandler.request({
        ref: {
          user,
          visitor,
          uid: screen.parameters.journalEntry.uid,
          jwt,
          minConsistency: 'weak',
        },
        refreshRef: () => {
          if (!activeVWC.get()) {
            return {
              promise: Promise.resolve({
                type: 'expired',
                data: undefined,
                error: new DisplayableError(
                  'server-refresh-required',
                  'refresh journal',
                  'screen is not mounted'
                ),
                retryAt: undefined,
              }),
              done: () => true,
              cancel: () => {},
            };
          }

          const loginContextUnch = ctx.login.value.get();
          if (loginContextUnch.state !== 'logged-in') {
            return {
              promise: Promise.resolve({
                type: 'error',
                data: undefined,
                error: new DisplayableError(
                  'server-refresh-required',
                  'refresh journal',
                  'not logged in'
                ),
                retryAt: undefined,
              }),
              done: () => true,
              cancel: () => {},
            };
          }
          const user = loginContextUnch;

          if (ctx.interests.visitor.value.get().loading) {
            return {
              promise: Promise.resolve({
                type: 'error',
                data: undefined,
                error: new DisplayableError(
                  'server-refresh-required',
                  'refresh journal',
                  'visitor not loaded'
                ),
                retryAt: undefined,
              }),
              done: () => true,
              cancel: () => {},
            };
          }
          const visitor = ctx.interests.visitor;

          const jwtUnch = journalEntryJWTVWC.get();
          if (jwtUnch === null) {
            return {
              promise: Promise.resolve({
                type: 'error',
                data: undefined,
                error: new DisplayableError(
                  'server-refresh-required',
                  'refresh journal',
                  'visitor not loaded'
                ),
                retryAt: undefined,
              }),
              done: () => true,
              cancel: () => {},
            };
          }
          const jwt = jwtUnch;

          return mapCancelable(
            refreshScreen(),
            (s): Result<JournalEntryMetadataRef> =>
              s.type !== 'success'
                ? s
                : s.data.parameters.journalEntry === null
                ? {
                    type: 'error',
                    data: undefined,
                    error: new DisplayableError('server-refresh-required', 'refresh journal'),
                    retryAt: undefined,
                  }
                : {
                    type: 'success',
                    data: {
                      uid: s.data.parameters.journalEntry.uid,
                      jwt,
                      user,
                      visitor,
                      minConsistency: 'none',
                    },
                    error: undefined,
                    retryAt: undefined,
                  }
          );
        },
      });
    };

    const journalEntryMetadataRequestVWC =
      createWritableValueWithCallbacks<RequestResult<JournalEntryMetadata> | null>(null);
    const journalEntryMetadataErroredVWC = createWritableValueWithCallbacks<boolean>(false);

    const cleanupJournalEntryMetadataRequester = (() => {
      const active = createWritableValueWithCallbacks(true);
      makeRequest();
      return () => {
        setVWC(active, false);
      };

      async function makeRequest() {
        const canceled = waitForValueWithCallbacksConditionCancelable(active, (a) => !a);
        canceled.promise.catch(() => {});
        const userNotLoading = waitForValueWithCallbacksConditionCancelable(
          ctx.login.value,
          (l) => l.state !== 'loading'
        );
        userNotLoading.promise.catch(() => {});
        const visitorNotLoading = waitForValueWithCallbacksConditionCancelable(
          ctx.interests.visitor.value,
          (v) => !v.loading
        );
        visitorNotLoading.promise.catch(() => {});

        await Promise.race([
          canceled.promise,
          Promise.all([userNotLoading.promise, visitorNotLoading.promise]),
        ]);

        userNotLoading.cancel();
        visitorNotLoading.cancel();

        if (!active.get()) {
          return;
        }

        const userUnch = ctx.login.value.get();
        if (userUnch.state !== 'logged-in') {
          canceled.cancel();
          setVWC(journalEntryMetadataErroredVWC, true);
          return;
        }
        const user = userUnch;

        if (ctx.interests.visitor.value.get().loading) {
          canceled.cancel();
          setVWC(journalEntryMetadataErroredVWC, true);
          return;
        }

        const jwt = journalEntryJWTVWC.get() ?? screen.parameters.journalEntry.jwt;
        const request = getJournalEntryMetadata(user, ctx.interests.visitor, jwt);
        setVWC(journalEntryMetadataRequestVWC, request);
        canceled.cancel();
      }
    })();

    const [journalEntryMetadataUnwrappedVWC, cleanupJournalEntryMetadataUnwrapper] =
      unwrapRequestResult(
        journalEntryMetadataRequestVWC,
        (d) => d.data,
        (v) => (v === null || v.type === 'loading' ? null : undefined)
      );

    const journalEntryMetadataVWC = createWritableValueWithCallbacks<
      JournalEntryMetadata | null | undefined
    >(null);
    const cleanupJournalEntryMetadataMergerVWC = createValuesWithCallbacksEffect(
      [journalEntryMetadataUnwrappedVWC, journalEntryMetadataErroredVWC],
      () => {
        const metadata = journalEntryMetadataUnwrappedVWC.get();
        if (metadata === undefined || metadata !== null) {
          setVWC(journalEntryMetadataVWC, metadata);
          return undefined;
        }

        if (journalEntryMetadataErroredVWC.get()) {
          setVWC(journalEntryMetadataVWC, undefined);
          return undefined;
        }

        return undefined;
      }
    );

    const readyVWC = createWritableValueWithCallbacks(false);
    const cleanupReady = createValuesWithCallbacksEffect([chatVWC, journalEntryMetadataVWC], () => {
      const chat = chatVWC.get();
      setVWC(readyVWC, chat !== null || journalEntryMetadataVWC.get() === undefined);
      return undefined;
    });

    return {
      ready: readyVWC,
      chat: chatVWC,
      metadata: journalEntryMetadataVWC,
      refreshJournalEntry: async () => {
        const journalEntryManager = journalEntryManagerUnwrappedVWC.get();
        if (journalEntryManager === null) {
          throw new Error('journal entry manager not initialized');
        }

        if (journalEntryManager.state.get().type !== 'ready') {
          throw new Error('journal entry manager not ready');
        }
        await journalEntryManager.sendMessage({ type: 'hard-refresh' }).promise;
        await waitForValueWithCallbacksConditionCancelable(
          journalEntryManager.state,
          (s) => s.type === 'ready' || s.type === 'error' || s.type === 'released'
        ).promise;
        return chatVWC.get();
      },
      dispose: () => {
        setVWC(activeVWC, false);
        cleanupJournalEntryManagerRequester();
        cleanupJournalEntryManagerUnwrapper();
        cleanupJournalEntryStateUnwrapper();
        cleanupJournalEntryJWTUnwrapper();
        cleanupChatWrappedUnwrapper();
        cleanupChatUnwrapper();
        cleanupJournalEntryManagerRefresher();
        cleanupJournalEntryMetadataRequester();
        cleanupJournalEntryMetadataUnwrapper();
        cleanupJournalEntryMetadataMergerVWC();
        cleanupReady();
      },
    };
  },
  component: (props) => <JournalEntryView {...props} />,
};
