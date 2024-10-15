import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createValuesWithCallbacksEffect } from '../../../../shared/hooks/createValuesWithCallbacksEffect';
import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { createMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
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
import {
  JournalEntryManager,
  JournalEntryManagerRef,
} from './lib/createJournalEntryManagerHandler';
import { VoiceNoteStateMachine } from './lib/createVoiceNoteStateMachine';
import { JournalChatState } from './lib/JournalChatState';

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
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const activeVWC = createWritableValueWithCallbacks(true);

    const getJournalEntryManager = (): RequestResult<JournalEntryManager> => {
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

      return ctx.resources.journalEntryManagerHandler.request({
        ref: {
          journalEntryUID: screen.parameters.journalEntry.uid,
          journalEntryJWT: screen.parameters.journalEntry.jwt,
        },
        refreshRef: (): CancelablePromise<Result<JournalEntryManagerRef>> => {
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
            (s): Result<JournalEntryManagerRef> =>
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
      createWritableValueWithCallbacks<RequestResult<JournalEntryManager> | null>(null);
    const cleanupJournalEntryManagerRequester = (() => {
      const request = getJournalEntryManager();
      setVWC(journalEntryManagerVWC, request);
      return () => {
        if (Object.is(journalEntryJWTVWC.get(), request)) {
          setVWC(journalEntryJWTVWC, null);
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

    const [journalEntryUIDVWC, cleanupJournalEntryUIDUnwrapper] = createMappedValueWithCallbacks(
      journalEntryManagerUnwrappedVWC,
      (d) => d?.journalEntryUID ?? null
    );
    const journalEntryJWTVWC = createWritableValueWithCallbacks<string | null>(null);
    const cleanupJournalEntryJWTUnwrapper = createValueWithCallbacksEffect(
      journalEntryManagerUnwrappedVWC,
      (d) => {
        if (d === null) {
          setVWC(journalEntryJWTVWC, null);
          return undefined;
        }

        return createValueWithCallbacksEffect(d.journalEntryJWT, (jwt) => {
          setVWC(journalEntryJWTVWC, jwt);
          return undefined;
        });
      }
    );

    const chatVWC = createWritableValueWithCallbacks<JournalChatState | null | undefined>(null);
    const cleanupChatUnwrapper = createValueWithCallbacksEffect(
      journalEntryManagerUnwrappedVWC,
      (d) => {
        if (d === null) {
          setVWC(chatVWC, null);
          return undefined;
        }

        return createValueWithCallbacksEffect(d.chat, (chat) => {
          setVWC(chatVWC, chat);
          return undefined;
        });
      }
    );
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

          if (d.isExpiredOrDisposed(nowServer)) {
            const raw = request.get();
            if (raw.type === 'success') {
              raw.reportExpired();
            }
            return;
          }

          const user = ctx.login.value.get();
          if (user.state !== 'logged-in') {
            return;
          }

          const visitor = ctx.interests.visitor.value.get();
          if (visitor.loading) {
            return;
          }

          if ((d.chat.get() === null || d.chat.get() === undefined) && d.task.get() === null) {
            d.refresh(user, ctx.interests.visitor);
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

        const user = ctx.login.value.get();
        if (user.state !== 'logged-in') {
          return;
        }

        if (userResponse.type === 'text') {
          await journalEntryManager.refresh(user, ctx.interests.visitor, {
            endpoint: '/api/1/journals/entries/chat/',
            bonusParams: async (clientKey) => ({
              version: SCREEN_VERSION,
              encrypted_user_message: await clientKey.key.encrypt(
                userResponse.value,
                await getCurrentServerTimeMS()
              ),
            }),
          });
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

          await journalEntryManager.refresh(user, ctx.interests.visitor, {
            endpoint: '/api/1/journals/entries/chat/voice_note',
            bonusParams: async (clientKey) => ({
              version: SCREEN_VERSION,
              encrypted_voice_note_uid: await clientKey.key.encrypt(
                state.voiceNote.uid,
                await getCurrentServerTimeMS()
              ),
            }),
          });
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

        const user = ctx.login.value.get();
        if (user.state !== 'logged-in') {
          throw new Error('user not logged in');
        }
        await journalEntryManager.refresh(user, ctx.interests.visitor);
        return journalEntryManager.chat.get();
      },
      dispose: () => {
        setVWC(activeVWC, false);
        cleanupJournalEntryManagerRequester();
        cleanupJournalEntryManagerUnwrapper();
        cleanupJournalEntryUIDUnwrapper();
        cleanupJournalEntryJWTUnwrapper();
        cleanupChatUnwrapper();
        cleanupJournalEntryManagerRefresher();
        cleanupMostRecentVoiceNoteReq();
        cleanupReady();
      },
    };
  },
  component: (props) => <JournalChat {...props} />,
};
