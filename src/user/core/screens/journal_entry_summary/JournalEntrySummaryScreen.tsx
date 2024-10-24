import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createValuesWithCallbacksEffect } from '../../../../shared/hooks/createValuesWithCallbacksEffect';
import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import {
  createWritableValueWithCallbacks,
  ValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../shared/lib/CancelablePromise';
import { createCancelableTimeout } from '../../../../shared/lib/createCancelableTimeout';
import { DisplayableError } from '../../../../shared/lib/errors';
import { getCurrentServerTimeMS } from '../../../../shared/lib/getCurrentServerTimeMS';
import { mapCancelable } from '../../../../shared/lib/mapCancelable';
import { SCREEN_VERSION } from '../../../../shared/lib/screenVersion';
import { setVWC } from '../../../../shared/lib/setVWC';
import { waitForValueWithCallbacksConditionCancelable } from '../../../../shared/lib/waitForValueWithCallbacksCondition';
import { RequestResult, Result } from '../../../../shared/requests/RequestHandler';
import { unwrapRequestResult } from '../../../../shared/requests/unwrapRequestResult';
import { OsehScreen } from '../../models/Screen';
import { screenConfigurableTriggerMapper } from '../../models/ScreenConfigurableTrigger';
import {
  computeJournalChatStateDataIntegrity,
  JournalChatState,
  JournalEntryItemDataDataSummaryV1,
} from '../journal_chat/lib/JournalChatState';
import { JournalEntrySummary } from './JournalEntrySummary';
import {
  JournalEntrySummaryAPIParams,
  JournalEntrySummaryMappedParams,
} from './JournalEntrySummaryParams';
import { JournalEntrySummaryResources } from './JournalEntrySummaryResources';
import * as JEStateMachine from '../journal_chat/lib/createJournalEntryStateMachine';
import { JournalEntryStateMachineRef } from '../journal_chat/lib/createJournalEntryStateMachineRequestHandler';
import { VISITOR_SOURCE } from '../../../../shared/lib/visitorSource';
import { createTypicalSmartAPIFetchMapper } from '../../../../shared/lib/smartApiFetch';
import { createMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';

/**
 * Shows the last v1 summary in the journal entry
 */
export const JournalEntrySummaryScreen: OsehScreen<
  'journal_entry_summary',
  JournalEntrySummaryResources,
  JournalEntrySummaryAPIParams,
  JournalEntrySummaryMappedParams
> = {
  slug: 'journal_entry_summary',
  paramMapper: (api) => ({
    entrance: api.entrance,
    header: api.header,
    hint: api.hint,
    regenerate: api.regenerate,
    edit: api.edit,
    journalEntry: api.journal_entry,
    cta: {
      text: api.cta.text,
      trigger: convertUsingMapper(api.cta.trigger, screenConfigurableTriggerMapper),
      exit: api.cta.exit,
    },
    close: {
      variant: api.close.variant,
      onlyIfError: api.close.only_if_error,
      trigger: convertUsingMapper(api.close.trigger, screenConfigurableTriggerMapper),
      exit: api.close.exit,
    },
    missingSummary: {
      endpoint: api.missing_summary.endpoint,
      maxRetries: api.missing_summary.max_retries,
    },
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const activeVWC = createWritableValueWithCallbacks(true);

    const getJournalEntryManager = (): RequestResult<JEStateMachine.JournalEntryStateMachine> => {
      if (screen.parameters.journalEntry === null) {
        return {
          data: createWritableValueWithCallbacks({
            type: 'error',
            data: undefined,
            error: new DisplayableError('server-refresh-required', 'refresh journal'),
            retryAt: undefined,
          }),
          release: () => {},
        };
      }

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
    const [summaryVWC, cleanupSummaryVWC] = createMappedValueWithCallbacks(chatVWC, (c) => {
      if (c === null) {
        return null;
      }

      if (c === undefined) {
        return undefined;
      }

      return extractSummary(c);
    });

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

    const tryUseChatToUpdateEntryList = () => {
      const user = ctx.login.value.get();
      if (user.state !== 'logged-in') {
        return;
      }

      const journalEntryManager = journalEntryManagerUnwrappedVWC.get();
      if (journalEntryManager === null) {
        return;
      }

      const state = journalEntryManager.state.get();
      if (state.type !== 'ready') {
        ctx.resources.journalEntryListHandler.evictOrReplace({ user });
        return;
      }

      const newChat = state.value.displayable.get();
      ctx.resources.journalEntryListHandler.evictOrReplace({ user }, (old) => {
        if (old === undefined) {
          return { type: 'make-request' };
        }

        old.listing.replaceItem(
          (je) => je.uid === screen.parameters.journalEntry.uid,
          (je) => ({
            ...je,
            payload: {
              ...je.payload,
              items: newChat.data,
            },
          })
        );

        return { type: 'data', data: old };
      });
    };

    // refresh chat according to screen parameters when missing a summary
    // cleans up via activeVWC
    (async () => {
      const canceled = waitForValueWithCallbacksConditionCancelable(activeVWC, (a) => !a);
      canceled.promise.catch(() => {});

      let failures = 0;
      let sleptForFailures = 0;
      while (true) {
        if (!activeVWC.get()) {
          canceled.cancel();
          return;
        }

        const state = journalEntryStateUnwrappedVWC.get();
        const stateChanged = waitForValueWithCallbacksConditionCancelable(
          journalEntryStateUnwrappedVWC,
          (s) => !Object.is(s, state)
        );
        stateChanged.promise.catch(() => {});
        if (state === null || state.type !== 'ready') {
          await Promise.race([canceled.promise, stateChanged.promise]);
          stateChanged.cancel();
          continue;
        }

        const extracted = extractSummary(state.value.displayable.get());
        if (extracted !== null) {
          failures = 0;
          tryUseChatToUpdateEntryList();
          await Promise.race([canceled.promise, stateChanged.promise]);
          stateChanged.cancel();
          continue;
        }

        if (failures >= screen.parameters.missingSummary.maxRetries) {
          await Promise.race([canceled.promise, stateChanged.promise]);
          stateChanged.cancel();
          continue;
        }

        if (failures > sleptForFailures) {
          const timeout = createCancelableTimeout(
            2000 * Math.pow(2, failures - 1) + Math.random() * 500
          );
          await Promise.race([timeout.promise, stateChanged.promise, canceled.promise]);
          if (timeout.done()) {
            sleptForFailures = failures;
          }
          stateChanged.cancel();
          timeout.cancel();
          continue;
        }

        stateChanged.cancel();

        const path =
          screen.parameters.missingSummary.endpoint.length === 0
            ? '/api/1/journals/entries/sync'
            : screen.parameters.missingSummary.endpoint[
                Math.min(screen.parameters.missingSummary.endpoint.length - 1, failures)
              ];

        const anticipated = JEStateMachine.deepClonePrimitives(state.value.displayable.get());
        const manager = journalEntryManagerUnwrappedVWC.get();
        if (manager === null) {
          continue;
        }

        const sentMessageCancelable = manager.sendMessage({
          type: 'incremental-refresh',
          get: async (user, visitor, clientKey, ref) => ({
            path,
            init: {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                Authorization: `bearer ${user.authTokens.idToken}`,
                ...((v) =>
                  v.loading || v.uid === null
                    ? {}
                    : ({
                        Visitor: v.uid,
                      } as Record<string, string>))(visitor.value.get()),
              },
              body: JSON.stringify({
                platform: VISITOR_SOURCE,
                version: SCREEN_VERSION,
                journal_entry_uid: ref.uid,
                journal_entry_jwt: ref.jwt,
                journal_client_key_uid: clientKey.uid,
              }),
            },
            retryer: 'default',
            mapper: createTypicalSmartAPIFetchMapper({
              mapJSON: (v) => v,
              action: 'ensure summary',
            }),
          }),
          anticipated,
        });
        await Promise.race([sentMessageCancelable.promise, canceled.promise]);
        if (sentMessageCancelable.done()) {
          failures++;
        }
        sentMessageCancelable.cancel();
        continue;
      }
    })();

    return {
      ready: createWritableValueWithCallbacks(true),
      summary: summaryVWC,
      trySubmitEdit: async (data: JournalEntryItemDataDataSummaryV1) => {
        if (screen.parameters.edit === null) {
          console.warn('cannot submit edit: no edit endpoint provided');
          return;
        }

        const summary = summaryVWC.get();
        if (summary === null || summary === undefined) {
          console.warn('cannot submit edit: no summary available');
          return;
        }

        const journalEntryManager = journalEntryManagerUnwrappedVWC.get();
        if (journalEntryManager === null) {
          return;
        }

        if (journalEntryManager.state.get().type !== 'ready') {
          return;
        }

        const chatState = chatVWC.get();
        if (chatState === null || chatState === undefined) {
          return;
        }

        const anticipated = JEStateMachine.deepClonePrimitives(chatState);
        anticipated.data[summary.entryCounter - 1] = {
          type: 'summary',
          display_author: 'other',
          data,
        };
        anticipated.integrity = await computeJournalChatStateDataIntegrity(anticipated);

        const path = screen.parameters.edit.endpoint;
        await journalEntryManager.sendMessage({
          type: 'incremental-refresh',
          get: async (user, visitor, clientKey, ref) => ({
            path,
            init: {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                Authorization: `bearer ${user.authTokens.idToken}`,
                ...((v) =>
                  v.loading || v.uid === null
                    ? {}
                    : ({
                        Visitor: v.uid,
                      } as Record<string, string>))(visitor.value.get()),
              },
              body: JSON.stringify({
                platform: VISITOR_SOURCE,
                version: SCREEN_VERSION,
                journal_entry_uid: ref.uid,
                journal_entry_jwt: ref.jwt,
                journal_client_key_uid: clientKey.uid,
                entry_counter: summary.entryCounter,
                encrypted_summary: await clientKey.key.encrypt(
                  JSON.stringify(data),
                  await getCurrentServerTimeMS()
                ),
              }),
            },
            retryer: 'default',
            mapper: createTypicalSmartAPIFetchMapper({
              mapJSON: (v) => v,
              action: 'edit reflection question',
            }),
          }),
          anticipated,
        }).promise;
      },
      tryRegenerate: async () => {
        if (screen.parameters.regenerate === null) {
          console.warn('cannot regenerate: no regenerate endpoint provided');
          return;
        }

        const journalEntryManager = journalEntryManagerUnwrappedVWC.get();
        if (journalEntryManager === null) {
          return;
        }

        const summary = summaryVWC.get();
        if (summary === null || summary === undefined) {
          console.warn('cannot submit edit: no summary available');
          return;
        }

        const chat = chatVWC.get();
        if (chat === null || chat === undefined) {
          throw new Error('chat not initialized');
        }

        const anticipated = JEStateMachine.deepClonePrimitives(chat);
        anticipated.data[summary.entryCounter - 1].data = {
          type: 'summary',
          version: 'v1',
          title: 'Brainstorming...',
          tags: [],
        };
        anticipated.integrity = '';

        const path = screen.parameters.regenerate.endpoint;
        journalEntryManager.sendMessage({
          type: 'incremental-refresh',
          get: async (user, visitor, clientKey, ref) => ({
            path,
            init: {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                Authorization: `bearer ${user.authTokens.idToken}`,
                ...((v) =>
                  v.loading || v.uid === null
                    ? {}
                    : ({
                        Visitor: v.uid,
                      } as Record<string, string>))(visitor.value.get()),
              },
              body: JSON.stringify({
                platform: VISITOR_SOURCE,
                version: SCREEN_VERSION,
                journal_entry_uid: ref.uid,
                journal_entry_jwt: ref.jwt,
                journal_client_key_uid: clientKey.uid,
                entry_counter: summary.entryCounter,
              }),
            },
            retryer: 'default',
            mapper: createTypicalSmartAPIFetchMapper({
              mapJSON: (v) => v,
              action: 'regenerate summary',
            }),
          }),
          anticipated,
        });
      },
      dispose: () => {
        setVWC(activeVWC, false);
        cleanupJournalEntryManagerRequester();
        cleanupJournalEntryManagerUnwrapper();
        cleanupJournalEntryStateUnwrapper();
        cleanupChatWrappedUnwrapper();
        cleanupChatUnwrapper();
        cleanupSummaryVWC();
        cleanupJournalEntryManagerRefresher();
      },
    };
  },
  component: (params) => <JournalEntrySummary {...params} />,
};

const extractSummary = (
  chat: JournalChatState
): {
  entryCounter: number;
  data: JournalEntryItemDataDataSummaryV1;
} | null => {
  let summary: {
    entryCounter: number;
    data: JournalEntryItemDataDataSummaryV1;
  } | null = null;
  for (let i = chat.data.length - 1; i >= 0; i--) {
    const entryItem = chat.data[i];
    if (entryItem.type === 'summary' && entryItem.data.type === 'summary') {
      summary = { entryCounter: i + 1, data: Object.assign({}, entryItem.data) };
    }
  }
  return summary;
};
