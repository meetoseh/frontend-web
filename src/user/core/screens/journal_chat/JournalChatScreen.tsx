import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createValuesWithCallbacksEffect } from '../../../../shared/hooks/createValuesWithCallbacksEffect';
import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { createMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import {
  createWritableValueWithCallbacks,
  ValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../shared/lib/CancelablePromise';
import { DisplayableError } from '../../../../shared/lib/errors';
import { getCurrentServerTimeMS } from '../../../../shared/lib/getCurrentServerTimeMS';
import { mapCancelable } from '../../../../shared/lib/mapCancelable';
import { SCREEN_VERSION } from '../../../../shared/lib/screenVersion';
import { setVWC } from '../../../../shared/lib/setVWC';
import { waitForValueWithCallbacksConditionCancelable } from '../../../../shared/lib/waitForValueWithCallbacksCondition';
import { RequestResult, Result } from '../../../../shared/requests/RequestHandler';
import { unwrapRequestResult } from '../../../../shared/requests/unwrapRequestResult';
import { OsehScreen } from '../../models/Screen';
import { screenJournalEntryKeyMap } from '../../models/ScreenJournalChat';
import { JournalChat } from './JournalChat';
import { JournalChatAPIParams, JournalChatMappedParams } from './JournalChatParams';
import { JournalChatResources } from './JournalChatResources';
import * as JEStateMachine from './lib/createJournalEntryStateMachine';
import { JournalEntryStateMachineRef } from './lib/createJournalEntryStateMachineRequestHandler';
import { VoiceNoteStateMachine } from './lib/createVoiceNoteStateMachine';
import { computeJournalChatStateDataIntegrity, JournalChatState } from './lib/JournalChatState';
import { createTypicalSmartAPIFetchMapper } from '../../../../shared/lib/smartApiFetch';
import { VISITOR_SOURCE } from '../../../../shared/lib/visitorSource';

/** the suggestions to use if the api does not provide them (for convenience when we're changing the api) */
const DEFAULT_SUGGESTIONS = [
  { text: 'I have a lot of anxiety right now', width: 160 },
  { text: 'I feel scattered and need to focus', width: 160 },
  { text: 'I’m feeling disconnected', width: 130 },
  { text: 'I’m having trouble sleeping and need to calm my mind', width: 240 },
  { text: 'I’m feeling a bit down and need encouragement', width: 238 },
  { text: 'I’m feeling happy and want to cherish this moment', width: 220 },
];

/**
 * Allows the user to chat with the system.
 */
export const JournalChatScreen: OsehScreen<
  'journal_chat',
  JournalChatResources,
  JournalChatAPIParams,
  JournalChatMappedParams
> = {
  slug: 'journal_chat',
  paramMapper: (params) => ({
    title: params.title,
    focus: params.focus,
    back: params.back,
    entrance: params.entrance,
    exit: params.exit,
    journeyTrigger: params.journey_trigger,
    upgradeTrigger: params.upgrade_trigger,
    journalEntry:
      params.journal_entry === null || params.journal_entry === undefined
        ? null
        : convertUsingMapper(params.journal_entry, screenJournalEntryKeyMap),
    autofill: params.autofill ?? '',
    suggestions: params.suggestions ?? DEFAULT_SUGGESTIONS,
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
            error: new DisplayableError(
              'server-refresh-required',
              'get journal entry',
              'journal entry not provided'
            ),
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
                  'get journal entry',
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
                    error: new DisplayableError(
                      'server-refresh-required',
                      'get journal entry',
                      'journal entry not provided'
                    ),
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

    const [journalEntryUIDVWC, cleanupJournalEntryUIDUnwrapper] = createMappedValueWithCallbacks(
      journalEntryStateUnwrappedVWC,
      (d) =>
        d !== null && d.type !== 'released' && d.type !== 'error' ? d.journalEntryRef.uid : null
    );
    const [journalEntryJWTVWC, cleanupJournalEntryJWTUnwrapper] = createMappedValueWithCallbacks(
      journalEntryStateUnwrappedVWC,
      (d) =>
        d !== null && d.type !== 'released' && d.type !== 'error' ? d.journalEntryRef.jwt : null
    );
    const [chatErrorVWC, cleanupChatErrorUnwrapper] = createMappedValueWithCallbacks(
      journalEntryStateUnwrappedVWC,
      (d) => {
        if (d === null) {
          return null;
        }
        if (d.type === 'error') {
          return d.error;
        }
        return null;
      }
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

    const mostRecentVoiceNoteReq =
      createWritableValueWithCallbacks<RequestResult<VoiceNoteStateMachine> | null>(null);

    const cleanupMostRecentVoiceNoteReq = () => {
      const val = mostRecentVoiceNoteReq.get();
      if (val === null) {
        return;
      }
      setVWC(mostRecentVoiceNoteReq, null);
      val.release();
    };

    const [readyVWC, cleanupReady] = createMappedValueWithCallbacks(
      chatVWC,
      (chat) => chat !== null
    );

    return {
      ready: readyVWC,
      chat: chatVWC,
      chatError: chatErrorVWC,
      journalEntryUID: journalEntryUIDVWC,
      journalEntryJWT: journalEntryJWTVWC,
      trySubmitUserResponse: async (
        userResponse:
          | { type: 'text'; value: string }
          | { type: 'voice'; voiceNote: VoiceNoteStateMachine }
      ) => {
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

        if (userResponse.type === 'text') {
          const text = userResponse.value;
          const paragraphs = text
            .split('\n')
            .map((p) => p.trim())
            .filter((p) => p.length > 0);

          if (paragraphs.length === 0) {
            return;
          }

          const anticipated = JEStateMachine.deepClonePrimitives(chatState);
          anticipated.data.push({
            type: 'chat',
            display_author: 'self',
            data: {
              type: 'textual',
              parts: paragraphs.map((p) => ({ type: 'paragraph' as const, value: p })),
            },
          });
          anticipated.integrity = await computeJournalChatStateDataIntegrity(anticipated);

          await journalEntryManager.sendMessage({
            type: 'incremental-refresh',
            get: async (user, visitor, clientKey, ref) => ({
              path: '/api/1/journals/entries/chat/',
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
                  encrypted_user_message: await clientKey.key.encrypt(
                    userResponse.value,
                    await getCurrentServerTimeMS()
                  ),
                }),
              },
              retryer: 'default',
              mapper: createTypicalSmartAPIFetchMapper({
                mapJSON: (v) => v,
                action: 'send chat message',
              }),
            }),
            anticipated,
          }).promise;
        } else {
          const stateReady = waitForValueWithCallbacksConditionCancelable(
            userResponse.voiceNote.state,
            (s) =>
              s.type === 'transcribing' ||
              s.type === 'local-ready' ||
              s.type === 'error' ||
              s.type === 'released'
          );
          stateReady.promise.catch(() => {});
          const released = waitForValueWithCallbacksConditionCancelable(activeVWC, (v) => !v);
          released.promise.catch(() => {});
          await Promise.race([stateReady.promise, released.promise]);
          stateReady.cancel();
          released.cancel();
          if (!activeVWC.get()) {
            return;
          }
          const state = userResponse.voiceNote.state.get();
          if (state.type !== 'transcribing' && state.type !== 'local-ready') {
            return;
          }

          const oldReq = mostRecentVoiceNoteReq.get();
          setVWC(
            mostRecentVoiceNoteReq,
            ctx.resources.voiceNoteHandler.requestWithData({
              ref: { voiceNoteUID: state.voiceNote.uid, voiceNoteJWT: state.voiceNote.jwt },
              refreshRef: () => ({
                promise: Promise.resolve({
                  type: 'error',
                  data: undefined,
                  error: new DisplayableError('server-refresh-required', 'save voice note'),
                  retryAt: undefined,
                }),
                done: () => true,
                cancel: () => {},
              }),
              data: userResponse.voiceNote,
            })
          );
          if (oldReq !== null) {
            oldReq.release();
          }

          const anticipated = JEStateMachine.deepClonePrimitives(chatState);
          anticipated.data.push({
            type: 'chat',
            display_author: 'self',
            data: {
              type: 'textual',
              parts: [
                {
                  transcription: {
                    uid: '',
                    phrases: [],
                  },
                  type: 'voice_note',
                  voice_note_uid: state.voiceNote.uid,
                  voice_note_jwt: state.voiceNote.jwt,
                },
              ],
            },
          });
          anticipated.integrity = await computeJournalChatStateDataIntegrity(anticipated);

          await journalEntryManager.sendMessage({
            type: 'incremental-refresh',
            get: async (user, visitor, clientKey, ref) => ({
              path: '/api/1/journals/entries/chat/voice_note',
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
                  encrypted_voice_note_uid: await clientKey.key.encrypt(
                    state.voiceNote.uid,
                    await getCurrentServerTimeMS()
                  ),
                }),
              },
              retryer: 'default',
              mapper: createTypicalSmartAPIFetchMapper({
                mapJSON: (v) => v,
                action: 'send chat message',
              }),
            }),
            anticipated,
          }).promise;
        }
        const journalEntryUID = journalEntryUIDVWC.get();
        if (journalEntryUID !== null) {
          ctx.resources.journalEntryMetadataHandler.evictOrReplace({ uid: journalEntryUID });
        }
      },
      refreshJournalEntry: async () => {
        const journalEntryManager = journalEntryManagerUnwrappedVWC.get();
        if (journalEntryManager === null) {
          throw new Error('journal entry manager not initialized');
        }

        if (journalEntryManager.state.get().type !== 'ready') {
          throw new Error('journal entry manager not ready');
        }

        const chat = chatVWC.get();
        if (chat === null || chat === undefined) {
          throw new Error('chat not initialized');
        }

        const anticipated = JEStateMachine.deepClonePrimitives(chat);
        await journalEntryManager.sendMessage({
          type: 'incremental-refresh',
          get: async (user, visitor, clientKey, ref) => ({
            path: '/api/1/journals/entries/sync',
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
              action: 'refresh chat',
            }),
          }),
          anticipated,
        }).promise;
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
        cleanupJournalEntryUIDUnwrapper();
        cleanupJournalEntryJWTUnwrapper();
        cleanupChatErrorUnwrapper();
        cleanupChatWrappedUnwrapper();
        cleanupChatUnwrapper();
        cleanupJournalEntryManagerRefresher();
        cleanupMostRecentVoiceNoteReq();
        cleanupReady();
      },
    };
  },
  component: (props) => <JournalChat {...props} />,
};
