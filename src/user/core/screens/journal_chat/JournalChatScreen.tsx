import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { createMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import {
  getOrCreateClientKey,
  WrappedJournalClientKey,
} from '../../../../shared/journals/clientKeys';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { createCancelableTimeout } from '../../../../shared/lib/createCancelableTimeout';
import { createFernet } from '../../../../shared/lib/fernet';
import { getCurrentServerTimeMS } from '../../../../shared/lib/getCurrentServerTimeMS';
import { setVWC } from '../../../../shared/lib/setVWC';
import { waitForValueWithCallbacksConditionCancelable } from '../../../../shared/lib/waitForValueWithCallbacksCondition';
import { OsehScreen } from '../../models/Screen';
import { screenConfigurableTriggerMapper } from '../../models/ScreenConfigurableTrigger';
import { screenJournalEntryKeyMap } from '../../models/ScreenJournalChat';
import { JournalChat } from './JournalChat';
import { JournalChatAPIParams, JournalChatMappedParams } from './JournalChatParams';
import { JournalChatResources } from './JournalChatResources';
import { JournalChatState } from './lib/JournalChatState';
import { replyToJournalEntry } from './lib/replyToJournalEntry';
import { syncToJournalEntry, SyncToJournalEntryStateDone } from './lib/syncToJournalEntry';

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
    const chatVWC = createWritableValueWithCallbacks<JournalChatState | null | undefined>(null);
    const journalEntryUIDVWC = createWritableValueWithCallbacks<string | null>(
      screen.parameters.journalEntry?.uid ?? null
    );
    const journalEntryJWTVWC = createWritableValueWithCallbacks<string | null>(
      screen.parameters.journalEntry?.jwt ?? null
    );
    const trySubmitUserResponseVWC = createWritableValueWithCallbacks<
      (userResponse: string) => void
    >(() => {
      throw new Error('not available yet');
    });

    const [readyVWC, cleanupReady] = createMappedValueWithCallbacks(
      chatVWC,
      (chat) => chat !== null
    );

    const cleanupChatFetcher = (() => {
      const entryUIDRaw = journalEntryUIDVWC.get();
      const entryJWTRaw = journalEntryJWTVWC.get();

      if (entryUIDRaw === null || entryJWTRaw === null) {
        setVWC(chatVWC, undefined);
        return;
      }

      const entryUID = entryUIDRaw;
      const entryJWT = entryJWTRaw;

      const loginContextUnch = ctx.login.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        return undefined;
      }
      const user = loginContextUnch;

      if (ctx.interests.value.get().state === 'loading') {
        return undefined;
      }

      const active = createWritableValueWithCallbacks(true);
      setVWC(trySubmitUserResponseVWC, (userResponse) => {
        throw new Error('not available yet');
      });
      fetchChat();
      return () => {
        setVWC(active, false);
      };

      async function fetchChat(retry?: number) {
        if (!active.get()) {
          return;
        }
        const clientKeyRaw = await getOrCreateClientKey(user, ctx.interests.visitor);
        if (!active.get()) {
          return;
        }
        const clientKey: WrappedJournalClientKey = {
          uid: clientKeyRaw.uid,
          key: await createFernet(clientKeyRaw.key),
        };
        if (!active.get()) {
          return;
        }

        const previousChat = chatVWC.get();

        const syncCancelable = syncToJournalEntry(user, entryUID, entryJWT, clientKey);
        const canceled = waitForValueWithCallbacksConditionCancelable(active, (a) => !a);
        canceled.promise.catch(() => {});
        const cleanupAttacher = createValueWithCallbacksEffect(syncCancelable.state, (state) => {
          if (state.type === 'done') {
            setVWC(chatVWC, state.conversation);
            return undefined;
          }

          if (state.type === 'reading-system-response') {
            return createValueWithCallbacksEffect(state.chat, (chat) => {
              if (chat.data.length === 0 && previousChat !== null) {
                setVWC(chatVWC, previousChat);
              } else {
                setVWC(chatVWC, chat);
              }
              return undefined;
            });
          }

          return undefined;
        });

        try {
          await Promise.race([syncCancelable.handlerCancelable.promise, canceled.promise]);

          if (!active.get()) {
            syncCancelable.handlerCancelable.cancel();
            return;
          }

          const finalState = syncCancelable.state.get();
          if (finalState.type !== 'done') {
            throw new Error(`unexpected final state ${finalState.type}`);
          }
          setVWC(journalEntryUIDVWC, finalState.journalEntryUID);
          setVWC(journalEntryJWTVWC, finalState.journalEntryJWT);
          setVWC(trySubmitUserResponseVWC, (userResponse) => {
            processUserResponse(finalState, userResponse);
          });
          setVWC(chatVWC, finalState.conversation);
        } catch (e) {
          if (!active.get()) {
            syncCancelable.handlerCancelable.cancel();
            return;
          }

          const nextRetry = (retry ?? 0) + 1;
          if (nextRetry > 3) {
            console.error('too many errors fetching chat', e);
            setVWC(chatVWC, undefined);
            return;
          }

          const finalState = syncCancelable.state.get();
          if (finalState.type === 'failed' && finalState.resolutionHint === 'retry') {
            const cancelableTimeout = createCancelableTimeout(1000 * Math.pow(2, nextRetry));
            cancelableTimeout.promise.catch(() => {});
            await Promise.race([cancelableTimeout.promise, canceled.promise]);
            cancelableTimeout.cancel();
            canceled.cancel();
            fetchChat(nextRetry);
            return;
          }

          console.error('error fetching chat', e, finalState);
          setVWC(chatVWC, undefined);
        } finally {
          cleanupAttacher();
        }
      }

      async function processUserResponse(
        sync: SyncToJournalEntryStateDone,
        userResponse: string,
        retry?: number
      ) {
        if (!active.get()) {
          return;
        }
        const clientKeyRaw = await getOrCreateClientKey(user, ctx.interests.visitor);
        if (!active.get()) {
          return;
        }
        const clientKey: WrappedJournalClientKey = {
          uid: clientKeyRaw.uid,
          key: await createFernet(clientKeyRaw.key),
        };
        if (!active.get()) {
          return;
        }
        const encryptedUserMessage = await clientKey.key.encrypt(
          userResponse,
          await getCurrentServerTimeMS()
        );

        const replyCancelable = replyToJournalEntry(
          user,
          entryUID,
          entryJWT,
          clientKey,
          encryptedUserMessage
        );
        const canceled = waitForValueWithCallbacksConditionCancelable(active, (a) => !a);
        canceled.promise.catch(() => {});
        const cleanupAttacher = createValueWithCallbacksEffect(replyCancelable.state, (state) => {
          if (state.type === 'done') {
            setVWC(chatVWC, state.conversation);
            return undefined;
          }

          if (state.type === 'reading-system-response') {
            return createValueWithCallbacksEffect(state.chat, (chat) => {
              if (chat.data.length === 0) {
                if (chat.transient === undefined || chat.transient === null) {
                  setVWC(chatVWC, sync.conversation);
                } else {
                  setVWC(chatVWC, { ...sync.conversation, transient: chat.transient });
                }
              } else {
                setVWC(chatVWC, chat);
              }
              return undefined;
            });
          }

          return undefined;
        });

        try {
          await Promise.race([replyCancelable.handlerCancelable.promise, canceled.promise]);

          if (!active.get()) {
            replyCancelable.handlerCancelable.cancel();
            return;
          }

          const finalState = replyCancelable.state.get();
          if (finalState.type !== 'done') {
            throw new Error(`unexpected final state ${finalState.type}`);
          }
          setVWC(journalEntryUIDVWC, finalState.journalEntryUID);
          setVWC(journalEntryJWTVWC, finalState.journalEntryJWT);
          setVWC(trySubmitUserResponseVWC, (userResponse) => {
            throw new Error('at most one response expected');
          });
          setVWC(chatVWC, finalState.conversation);
        } catch (e) {
          if (!active.get()) {
            replyCancelable.handlerCancelable.cancel();
            return;
          }

          const nextRetry = (retry ?? 0) + 1;
          if (nextRetry > 3) {
            console.error('too many errors storing reply', e);
            setVWC(chatVWC, undefined);
            return;
          }

          const finalState = replyCancelable.state.get();
          if (finalState.type === 'failed' && finalState.resolutionHint === 'retry') {
            const cancelableTimeout = createCancelableTimeout(1000 * Math.pow(2, nextRetry));
            cancelableTimeout.promise.catch(() => {});
            await Promise.race([cancelableTimeout.promise, canceled.promise]);
            cancelableTimeout.cancel();
            canceled.cancel();
            processUserResponse(sync, userResponse, nextRetry);
            return;
          }

          console.error('error storing reply', e, finalState);
          setVWC(chatVWC, undefined);
        } finally {
          cleanupAttacher();
        }
      }
    })();

    return {
      ready: readyVWC,
      chat: chatVWC,
      journalEntryUID: journalEntryUIDVWC,
      journalEntryJWT: journalEntryJWTVWC,
      trySubmitUserResponse: (userResponse: string) => {
        trySubmitUserResponseVWC.get()(userResponse);
      },
      dispose: () => {
        cleanupReady();
        cleanupChatFetcher?.();
      },
    };
  },
  component: (props) => <JournalChat {...props} />,
};
