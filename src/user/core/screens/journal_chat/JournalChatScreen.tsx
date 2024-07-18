import { createValuesWithCallbacksEffect } from '../../../../shared/hooks/createValuesWithCallbacksEffect';
import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { createMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import {
  getOrCreateClientKey,
  WrappedJournalClientKey,
} from '../../../../shared/journals/clientKeys';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { createFernet } from '../../../../shared/lib/fernet';
import { getCurrentServerTimeMS } from '../../../../shared/lib/getCurrentServerTimeMS';
import { setVWC } from '../../../../shared/lib/setVWC';
import { waitForValueWithCallbacksConditionCancelable } from '../../../../shared/lib/waitForValueWithCallbacksCondition';
import { OsehScreen } from '../../models/Screen';
import { JournalChat } from './JournalChat';
import { JournalChatAPIParams, JournalChatMappedParams } from './JournalChatParams';
import { JournalChatResources } from './JournalChatResources';
import { JournalChatState } from './lib/JournalChatState';
import { replyToJournalEntry } from './lib/replyToJournalEntry';
import { startJournalEntry, StartJournalEntryStateDone } from './lib/startJournalEntry';

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
  paramMapper: (params) => {
    const result: JournalChatMappedParams = {
      ...params,
      journeyTrigger: params.journey_trigger,
      upgradeTrigger: params.upgrade_trigger,
      __mapped: true,
    };
    delete (result as any).journey_trigger;
    delete (result as any).upgrade_trigger;
    return result;
  },
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const greetingInfoVWC = createWritableValueWithCallbacks<StartJournalEntryStateDone | null>(
      null
    );
    const greetingVWC = createWritableValueWithCallbacks<JournalChatState | null | undefined>(null);
    const userMessageVWC = createWritableValueWithCallbacks<string | null>(null);
    const systemReplyVWC = createWritableValueWithCallbacks<JournalChatState | null | undefined>(
      null
    );
    const [readyVWC, cleanupReady] = createMappedValueWithCallbacks(greetingVWC, (g) => g !== null);

    const journalEntryUIDVWC = createWritableValueWithCallbacks<string | null>(null);
    const journalEntryJWTVWC = createWritableValueWithCallbacks<string | null>(null);
    const chatVWC = createWritableValueWithCallbacks<JournalChatState | null | undefined>(null);
    const cleanupChatVWC = createValuesWithCallbacksEffect(
      [greetingVWC, userMessageVWC, systemReplyVWC],
      () => {
        const greeting = greetingVWC.get();
        if (greeting === null) {
          setVWC(chatVWC, null);
          return undefined;
        }

        if (greeting === undefined) {
          setVWC(chatVWC, {
            uid: 'clientside',
            integrity: '',
            data: [
              {
                type: 'chat',
                display_author: 'other',
                data: {
                  type: 'textual',
                  parts: [
                    {
                      type: 'paragraph',
                      value:
                        'Sorry, something went wrong. Please try again later or contact support by emailing hi@oseh.com',
                    },
                  ],
                },
              },
            ],
            transient: null,
          });
          return undefined;
        }

        const userMessage = userMessageVWC.get();
        if (userMessage === null) {
          setVWC(chatVWC, greeting);
          return undefined;
        }

        const userParagraphs = userMessage.split('\n').map((p) => p.trim());

        const fullChat: JournalChatState = {
          uid: 'clientside',
          integrity: '',
          data: [
            ...greeting.data,
            {
              data: {
                type: 'textual',
                parts: userParagraphs.map((p) => ({
                  type: 'paragraph',
                  value: p,
                })),
              },
              display_author: 'self',
              type: 'chat',
            },
          ],
          transient: null,
        };

        const systemReply = systemReplyVWC.get();
        if (systemReply === null) {
          fullChat.transient = {
            type: 'thinking-spinner',
            message: 'Sending your message...',
            detail: null,
          };
          setVWC(chatVWC, fullChat);
          return undefined;
        }

        if (systemReply === undefined) {
          fullChat.data.push({
            data: {
              type: 'textual',
              parts: [
                {
                  type: 'paragraph',
                  value:
                    'Sorry, something went wrong. Please try again later or contact support by emailing hi@oseh.com',
                },
              ],
            },
            display_author: 'other',
            type: 'chat',
          });
          setVWC(chatVWC, fullChat);
          return undefined;
        }

        fullChat.data.push(...systemReply.data);
        fullChat.transient = systemReply.transient;
        setVWC(chatVWC, fullChat);
        return undefined;
      }
    );

    const cleanupGetGreeting = createValuesWithCallbacksEffect(
      [ctx.login.value, ctx.interests.value],
      () => {
        const loginContextUnch = ctx.login.value.get();
        if (loginContextUnch.state === 'loading') {
          return undefined;
        }

        if (loginContextUnch.state === 'logged-out') {
          setVWC(greetingVWC, undefined);
          return undefined;
        }

        if (ctx.interests.value.get().state === 'loading') {
          setVWC(greetingVWC, null);
          return undefined;
        }

        const oldGreeting = greetingInfoVWC.get();
        if (oldGreeting !== null && oldGreeting !== undefined) {
          return undefined;
        }

        const user = loginContextUnch;
        const active = createWritableValueWithCallbacks(true);
        getGreeting();
        return () => {
          setVWC(active, false);
        };

        async function getGreeting() {
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

          const greetingCancelable = startJournalEntry(user, clientKey);
          const canceled = waitForValueWithCallbacksConditionCancelable(active, (a) => !a);
          const cleanupAttacher = createValueWithCallbacksEffect(
            greetingCancelable.state,
            (startState) => {
              if (startState.type === 'creating-entry') {
                return undefined;
              }
              if (startState.type === 'failed') {
                return undefined;
              }
              if (startState.type === 'done') {
                setVWC(greetingVWC, startState.greeting);
                return undefined;
              }

              return createValueWithCallbacksEffect(startState.chat, (c) => {
                setVWC(greetingVWC, c);
                return undefined;
              });
            }
          );

          try {
            await Promise.race([greetingCancelable.handlerCancelable.promise, canceled.promise]);
            if (!active.get()) {
              greetingCancelable.handlerCancelable.cancel();
            }
            await greetingCancelable.handlerCancelable.promise;
            const finalState = greetingCancelable.state.get();
            if (finalState.type === 'done') {
              setVWC(greetingInfoVWC, finalState);
            }
          } catch (e) {
            if (active.get()) {
              console.warn('error getting greeting:', e);
              setVWC(greetingVWC, undefined);
            }
          } finally {
            cleanupAttacher();
          }
        }
      }
    );

    const cleanupGetSystemReply = createValuesWithCallbacksEffect(
      [greetingInfoVWC, userMessageVWC, ctx.login.value],
      () => {
        const loginContextUnch = ctx.login.value.get();
        if (loginContextUnch.state === 'loading') {
          return undefined;
        }

        if (loginContextUnch.state === 'logged-out') {
          setVWC(greetingVWC, undefined);
          return undefined;
        }

        if (ctx.interests.value.get().state === 'loading') {
          setVWC(greetingVWC, null);
          return undefined;
        }

        const greetingInfoRaw = greetingInfoVWC.get();
        if (greetingInfoRaw === null || greetingInfoRaw === undefined) {
          setVWC(systemReplyVWC, null);
          return undefined;
        }

        const userMessageRaw = userMessageVWC.get();
        if (userMessageRaw === null) {
          setVWC(systemReplyVWC, null);
          return undefined;
        }

        const oldSystemReply = systemReplyVWC.get();
        if (oldSystemReply !== null && oldSystemReply !== undefined) {
          return undefined;
        }

        const user = loginContextUnch;
        const greetingInfo = greetingInfoRaw;
        const userMessage = userMessageRaw;
        const active = createWritableValueWithCallbacks(true);
        getSystemReply();
        return () => {
          setVWC(active, false);
        };

        async function getSystemReply() {
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
            userMessage,
            await getCurrentServerTimeMS()
          );
          if (!active.get()) {
            return;
          }

          const replyCancelable = replyToJournalEntry(
            user,
            greetingInfo.journalEntryUID,
            greetingInfo.journalEntryJWT,
            clientKey,
            encryptedUserMessage
          );
          const canceled = waitForValueWithCallbacksConditionCancelable(active, (a) => !a);
          const cleanupAttacher = createValueWithCallbacksEffect(
            replyCancelable.state,
            (startState) => {
              if (startState.type === 'saving-user-reply') {
                return undefined;
              }
              if (startState.type === 'failed') {
                return undefined;
              }
              if (startState.type === 'done') {
                setVWC(systemReplyVWC, startState.reply);
                return undefined;
              }

              return createValueWithCallbacksEffect(startState.chat, (c) => {
                setVWC(systemReplyVWC, c);
                return undefined;
              });
            }
          );

          try {
            await Promise.race([replyCancelable.handlerCancelable.promise, canceled.promise]);
            if (!active.get()) {
              replyCancelable.handlerCancelable.cancel();
            }
            await replyCancelable.handlerCancelable.promise;

            if (active.get()) {
              const finalState = replyCancelable.state.get();
              if (finalState.type === 'done') {
                setVWC(journalEntryUIDVWC, finalState.journalEntryUID);
                setVWC(journalEntryJWTVWC, finalState.journalEntryJWT);
              }
            }
          } catch (e) {
            if (active.get()) {
              console.warn('error getting reply:', e);
              setVWC(systemReplyVWC, undefined);
            }
          } finally {
            cleanupAttacher();
          }
        }
      }
    );

    return {
      ready: readyVWC,
      chat: chatVWC,
      journalEntryUID: journalEntryUIDVWC,
      journalEntryJWT: journalEntryJWTVWC,
      trySubmitUserResponse: (userResponse) => {
        if (userMessageVWC.get() === null) {
          setVWC(userMessageVWC, userResponse);
        }
      },
      dispose: () => {
        cleanupReady();
        cleanupChatVWC();
        cleanupGetGreeting();
        cleanupGetSystemReply();
      },
    };
  },
  component: (props) => <JournalChat {...props} />,
};
