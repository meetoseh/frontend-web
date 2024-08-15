import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createValuesWithCallbacksEffect } from '../../../../shared/hooks/createValuesWithCallbacksEffect';
import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { createMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../shared/lib/CancelablePromise';
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
  JournalEntryManager,
  JournalEntryManagerRef,
} from '../journal_chat/lib/createJournalEntryManagerHandler';
import { JournalChatState } from '../journal_chat/lib/JournalChatState';
import { JournalReflectionResponse } from './JournalReflectionResponse';
import {
  JourneyReflectionResponseAPIParams,
  JourneyReflectionResponseMappedParams,
} from './JournalReflectionResponseParams';
import { JournalReflectionResponseResources } from './JournalReflectionResponseResources';

/**
 * Shows the last journal reflection question and allows the user to respond
 * to it.
 */
export const JournalReflectionResponseScreen: OsehScreen<
  'journal_reflection_response',
  JournalReflectionResponseResources,
  JourneyReflectionResponseAPIParams,
  JourneyReflectionResponseMappedParams
> = {
  slug: 'journal_reflection_response',
  paramMapper: (api) => ({
    entrance: api.entrance,
    header: api.header,
    add: api.add,
    edit: api.edit,
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

    const getJournalEntryManager = (): RequestResult<JournalEntryManager> => {
      if (screen.parameters.journalEntry === null) {
        return {
          data: createWritableValueWithCallbacks({
            type: 'error',
            data: undefined,
            error: <>Journal entry not provided by server</>,
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
                error: <>Screen is not mounted</>,
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
                    error: <>Journal entry not provided by server</>,
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

    const retryCounterVWC = createWritableValueWithCallbacks(0);
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
              setVWC(retryCounterVWC, 0);
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
            setVWC(retryCounterVWC, 0);
            d.refresh(user, ctx.interests.visitor);
          }
        }
      }
    );

    const questionVWC = createWritableValueWithCallbacks<
      { entryCounter: number; paragraphs: string[] } | null | undefined
    >(null);
    const responseVWC = createWritableValueWithCallbacks<
      { entryCounter: number; value: string } | 'loading' | 'error' | 'dne'
    >('loading');

    const cleanupJournalEntryManagerRetrier = createValueWithCallbacksEffect(
      journalEntryManagerUnwrappedVWC,
      () => {
        const requestRaw = journalEntryManagerVWC.get();
        if (requestRaw === null) {
          return;
        }
        const request = requestRaw.data;

        return createValueWithCallbacksEffect(request, () => {
          const data = request.get();
          if (data.type !== 'success') {
            return undefined;
          }

          const manager = data.data;
          const active = createWritableValueWithCallbacks(true);
          retryUntilHaveQuestion();
          return () => {
            setVWC(active, false);
          };

          async function retryUntilHaveQuestion() {
            const canceled = waitForValueWithCallbacksConditionCancelable(active, (a) => !a);
            canceled.promise.catch(() => {});
            if (!active.get()) {
              canceled.cancel();
              return;
            }

            let chat = manager.chat.get();
            let chatChanged = waitForValueWithCallbacksConditionCancelable(
              manager.chat,
              (c) => !Object.is(c, chat)
            );
            chatChanged.promise.catch(() => {});
            let task = manager.task.get();
            let taskChanged = waitForValueWithCallbacksConditionCancelable(
              manager.task,
              (t) => !Object.is(t, task)
            );
            taskChanged.promise.catch(() => {});

            while (true) {
              if (!active.get()) {
                canceled.cancel();
                chatChanged.cancel();
                taskChanged.cancel();
                return;
              }

              if (chatChanged.done()) {
                chat = manager.chat.get();
                chatChanged = waitForValueWithCallbacksConditionCancelable(
                  manager.chat,
                  (
                    (chat) => (c) =>
                      !Object.is(c, chat)
                  )(chat)
                );
                chatChanged.promise.catch(() => {});
                continue;
              }

              if (taskChanged.done()) {
                task = manager.task.get();
                taskChanged = waitForValueWithCallbacksConditionCancelable(
                  manager.task,
                  (
                    (task) => (t) =>
                      !Object.is(t, task)
                  )(task)
                );
                taskChanged.promise.catch(() => {});
                continue;
              }

              if (chat === undefined) {
                setVWC(questionVWC, undefined);
                setVWC(responseVWC, 'error');
                await Promise.race([taskChanged.promise, chatChanged.promise, canceled.promise]);
                continue;
              }

              if (chat === null) {
                setVWC(questionVWC, null);
                setVWC(responseVWC, 'loading');
                await Promise.race([chatChanged.promise, taskChanged.promise, canceled.promise]);
                continue;
              }

              let question: { entryCounter: number; paragraphs: string[] } | null = null;
              let response: { entryCounter: number; value: string } | 'dne' = 'dne';
              for (let i = chat.data.length - 1; i >= 0; i--) {
                const entryItem = chat.data[i];
                if (
                  (entryItem.type === 'reflection-question' ||
                    entryItem.type === 'reflection-response') &&
                  entryItem.data.type === 'textual'
                ) {
                  const textData = entryItem.data;
                  const parts = [];
                  for (let j = 0; j < textData.parts.length; j++) {
                    const part = textData.parts[j];
                    if (part.type === 'paragraph') {
                      parts.push(part.value);
                    }
                  }
                  if (parts.length > 0) {
                    if (entryItem.type === 'reflection-question') {
                      question = { entryCounter: i + 1, paragraphs: parts };
                    } else if (entryItem.type === 'reflection-response') {
                      response = { entryCounter: i + 1, value: parts.join('\n\n') };
                    }
                  }
                }
              }

              if (task !== null) {
                await Promise.race([chatChanged.promise, taskChanged.promise, canceled.promise]);
                continue;
              }

              setVWC(questionVWC, question);
              setVWC(responseVWC, response);
              await Promise.race([taskChanged.promise, chatChanged.promise, canceled.promise]);
            }
          }
        });
      }
    );

    return {
      ready: createWritableValueWithCallbacks(true),
      question: questionVWC,
      savedResponse: responseVWC,
      updateResponse: async (userResponse: string) => {
        const question = questionVWC.get();
        if (question === null || question === undefined) {
          console.warn('cannot submit edit: no question available');
          return Promise.reject(new Error('no question available'));
        }

        const currentResponse = responseVWC.get();
        if (currentResponse === 'error' || currentResponse === 'loading') {
          console.warn('cannot submit edit: response not available');
          return Promise.reject(new Error('response not available'));
        }

        const journalEntryManager = journalEntryManagerUnwrappedVWC.get();
        if (journalEntryManager === null) {
          return Promise.reject(new Error('journal entry manager not available'));
        }

        const user = ctx.login.value.get();
        if (user.state !== 'logged-in') {
          return Promise.reject(new Error('user not logged in'));
        }

        await journalEntryManager.refresh(user, ctx.interests.visitor, {
          endpoint:
            currentResponse === 'dne'
              ? screen.parameters.add.endpoint
              : screen.parameters.edit.endpoint,
          bonusParams: async (clientKey) => ({
            version: SCREEN_VERSION,
            ...(currentResponse !== 'dne' ? { entry_counter: currentResponse.entryCounter } : {}),
            encrypted_reflection_response: await clientKey.key.encrypt(
              userResponse,
              await getCurrentServerTimeMS()
            ),
          }),
          sticky: true,
        });
        const journalEntryUID = journalEntryUIDVWC.get();
        if (journalEntryUID !== null) {
          ctx.resources.journalEntryMetadataHandler.evictOrReplace({ uid: journalEntryUID });
        }
      },
      dispose: () => {
        setVWC(activeVWC, false);
        cleanupJournalEntryManagerRequester();
        cleanupJournalEntryManagerUnwrapper();
        cleanupJournalEntryUIDUnwrapper();
        cleanupJournalEntryJWTUnwrapper();
        cleanupChatUnwrapper();
        cleanupJournalEntryManagerRefresher();
        cleanupJournalEntryManagerRetrier();
      },
    };
  },
  component: (params) => <JournalReflectionResponse {...params} />,
};
