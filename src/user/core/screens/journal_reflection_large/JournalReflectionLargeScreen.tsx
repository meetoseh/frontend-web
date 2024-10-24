import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
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
} from '../journal_chat/lib/JournalChatState';
import { JournalReflectionLarge } from './JournalReflectionLarge';
import {
  JournalReflectionLargeMappedParams,
  JourneyReflectionLargeAPIParams,
} from './JournalReflectionLargeParams';
import { JournalReflectionLargeResources } from './JournalReflectionLargeResources';
import * as JEStateMachine from '../journal_chat/lib/createJournalEntryStateMachine';
import { JournalEntryStateMachineRef } from '../journal_chat/lib/createJournalEntryStateMachineRequestHandler';
import { createMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { createTypicalSmartAPIFetchMapper } from '../../../../shared/lib/smartApiFetch';
import { VISITOR_SOURCE } from '../../../../shared/lib/visitorSource';
/**
 * Shows the last reflection question in the journal entry
 */
export const JournalReflectionLargeScreen: OsehScreen<
  'journal_reflection_large',
  JournalReflectionLargeResources,
  JourneyReflectionLargeAPIParams,
  JournalReflectionLargeMappedParams
> = {
  slug: 'journal_reflection_large',
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
    missingReflectionQuestion: {
      endpoint: api.missing_reflection_question.endpoint,
      maxRetries: api.missing_reflection_question.max_retries,
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
        console.log(
          `  callback state: ${d.type}: `,
          extractQuestion(d.value.displayable.get())?.paragraphs.join('\n')
        );
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
          const qn = extractQuestion(s);
          console.log('  ->', qn?.paragraphs.join('\n'));
          return undefined;
        });
      });
      return [result, cleanup];
    })();
    const [questionVWC, cleanupQuestionVWC] = createMappedValueWithCallbacks(chatVWC, (c) => {
      if (c === null) {
        return null;
      }

      if (c === undefined) {
        return undefined;
      }

      return extractQuestion(c);
    });

    // refresh chat according to screen parameters when missing a question
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

        const extracted = extractQuestion(state.value.displayable.get());
        if (extracted !== null) {
          failures = 0;
          await Promise.race([canceled.promise, stateChanged.promise]);
          stateChanged.cancel();
          continue;
        }

        if (failures >= screen.parameters.missingReflectionQuestion.maxRetries) {
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
          screen.parameters.missingReflectionQuestion.endpoint.length === 0
            ? '/api/1/journals/entries/sync'
            : screen.parameters.missingReflectionQuestion.endpoint[
                Math.min(screen.parameters.missingReflectionQuestion.endpoint.length - 1, failures)
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
              action: 'ensure reflection question',
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
      question: questionVWC,
      trySubmitEdit: async (userResponse: string) => {
        if (screen.parameters.edit === null) {
          console.warn('cannot submit edit: no edit endpoint provided');
          return;
        }

        const question = questionVWC.get();
        if (question === null || question === undefined) {
          console.warn('cannot submit edit: no question available');
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

        const text = userResponse;
        const paragraphs = text
          .split('\n')
          .map((p) => p.trim())
          .filter((p) => p.length > 0);

        if (paragraphs.length === 0) {
          return;
        }

        const anticipated = JEStateMachine.deepClonePrimitives(chatState);
        anticipated.data[question.entryCounter - 1] = {
          type: 'reflection-question',
          display_author: 'other',
          data: {
            type: 'textual',
            parts: paragraphs.map((p) => ({ type: 'paragraph' as const, value: p })),
          },
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
                entry_counter: question.entryCounter,
                encrypted_reflection_question: await clientKey.key.encrypt(
                  userResponse,
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
      tryRegenerate: () => {
        if (screen.parameters.regenerate === null) {
          console.warn('cannot regenerate: no regenerate endpoint provided');
          return;
        }

        const journalEntryManager = journalEntryManagerUnwrappedVWC.get();
        if (journalEntryManager === null) {
          throw new Error('journal entry manager not initialized');
        }

        if (journalEntryManager.state.get().type !== 'ready') {
          throw new Error('journal entry manager not ready');
        }

        const question = questionVWC.get();
        if (question === null || question === undefined) {
          journalEntryManager.sendMessage({
            type: 'hard-refresh',
          });
          return;
        }

        const chat = chatVWC.get();
        if (chat === null || chat === undefined) {
          throw new Error('chat not initialized');
        }

        const anticipated = JEStateMachine.deepClonePrimitives(chat);
        anticipated.data[question.entryCounter - 1].data = {
          type: 'textual',
          parts: [
            {
              type: 'paragraph',
              value: 'Brainstorming...',
            },
          ],
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
                entry_counter: question.entryCounter,
              }),
            },
            retryer: 'default',
            mapper: createTypicalSmartAPIFetchMapper({
              mapJSON: (v) => v,
              action: 'regenerate reflection question',
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
        cleanupQuestionVWC();
      },
    };
  },
  component: (params) => <JournalReflectionLarge {...params} />,
};

const extractQuestion = (
  chat: JournalChatState
): { entryCounter: number; paragraphs: string[] } | null => {
  let question: { entryCounter: number; paragraphs: string[] } | null = null;
  for (let i = chat.data.length - 1; i >= 0; i--) {
    const entryItem = chat.data[i];
    if (entryItem.type === 'reflection-question' && entryItem.data.type === 'textual') {
      const textData = entryItem.data;
      const parts = [];
      for (let j = 0; j < textData.parts.length; j++) {
        const part = textData.parts[j];
        if (part.type === 'paragraph') {
          parts.push(part.value);
        }
      }
      if (parts.length > 0) {
        question = { entryCounter: i + 1, paragraphs: parts };
      }
    }
  }
  return question;
};
