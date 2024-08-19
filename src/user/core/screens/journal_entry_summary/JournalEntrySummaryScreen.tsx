import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createValuesWithCallbacksEffect } from '../../../../shared/hooks/createValuesWithCallbacksEffect';
import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../shared/lib/CancelablePromise';
import { createCancelableTimeout } from '../../../../shared/lib/createCancelableTimeout';
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
import {
  JournalChatState,
  JournalEntryItemDataDataSummaryV1,
} from '../journal_chat/lib/JournalChatState';
import { JournalEntrySummary } from './JournalEntrySummary';
import {
  JournalEntrySummaryAPIParams,
  JournalEntrySummaryMappedParams,
} from './JournalEntrySummaryParams';
import { JournalEntrySummaryResources } from './JournalEntrySummaryResources';

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

    const tryUseChatToUpdateEntryList = () => {
      const user = ctx.login.value.get();
      if (user.state !== 'logged-in') {
        return;
      }

      const journalEntryManager = journalEntryManagerUnwrappedVWC.get();
      if (journalEntryManager === null) {
        return;
      }

      const newChat = journalEntryManager.chat.get();
      if (newChat === null || newChat === undefined) {
        ctx.resources.journalEntryListHandler.evictOrReplace({ user });
        return;
      }

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

    const summaryVWC = createWritableValueWithCallbacks<
      { entryCounter: number; data: JournalEntryItemDataDataSummaryV1 } | null | undefined
    >(null);
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
          retryUntilHaveSummary();
          return () => {
            setVWC(active, false);
          };

          async function retryUntilHaveSummary() {
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
                setVWC(summaryVWC, undefined);
                await Promise.race([taskChanged.promise, chatChanged.promise, canceled.promise]);
                continue;
              }

              if (chat === null) {
                setVWC(summaryVWC, null);
                await Promise.race([chatChanged.promise, taskChanged.promise, canceled.promise]);
                continue;
              }

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

              if (summary !== null) {
                setVWC(summaryVWC, summary);

                if (task === null) {
                  tryUseChatToUpdateEntryList();
                }

                // chat will change when we edit / regenerate
                await Promise.race([taskChanged.promise, chatChanged.promise, canceled.promise]);
                continue;
              }

              if (task !== null) {
                await Promise.race([taskChanged.promise, chatChanged.promise, canceled.promise]);
                continue;
              }

              const failures = retryCounterVWC.get();
              if (failures >= screen.parameters.missingSummary.maxRetries) {
                tryUseChatToUpdateEntryList();
                setVWC(summaryVWC, undefined);
                await Promise.race([taskChanged.promise, chatChanged.promise, canceled.promise]);
                continue;
              }

              setVWC(summaryVWC, null);
              setVWC(retryCounterVWC, failures + 1);
              if (failures > 0) {
                const timeout = createCancelableTimeout(
                  2000 * Math.pow(2, failures - 1) + Math.random() * 500
                );
                await Promise.race([
                  timeout.promise,
                  chatChanged.promise,
                  taskChanged.promise,
                  canceled.promise,
                ]);
                if (
                  !timeout.done() ||
                  chatChanged.done() ||
                  taskChanged.done() ||
                  canceled.done()
                ) {
                  timeout.cancel();
                  continue;
                }
              }

              const user = ctx.login.value.get();
              if (user.state !== 'logged-in') {
                console.warn('failed to retry summary generation: user not logged in');
                setVWC(summaryVWC, undefined);
                await Promise.race([taskChanged.promise, chatChanged.promise, canceled.promise]);
                continue;
              }

              manager.refresh(user, ctx.interests.visitor, {
                endpoint:
                  screen.parameters.missingSummary.endpoint.length === 0
                    ? '/api/1/journals/entries/sync'
                    : screen.parameters.missingSummary.endpoint[
                        Math.min(screen.parameters.missingSummary.endpoint.length - 1, failures)
                      ],
                unsafeToRetry: false,
              });
              await Promise.race([chatChanged.promise, taskChanged.promise, canceled.promise]);
            }
          }
        });
      }
    );

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

        const user = ctx.login.value.get();
        if (user.state !== 'logged-in') {
          return;
        }

        await journalEntryManager.refresh(user, ctx.interests.visitor, {
          endpoint: screen.parameters.edit.endpoint,
          bonusParams: async (clientKey) => ({
            version: SCREEN_VERSION,
            entry_counter: summary.entryCounter,
            encrypted_summary: await clientKey.key.encrypt(
              JSON.stringify(data),
              await getCurrentServerTimeMS()
            ),
          }),
        });
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

        const user = ctx.login.value.get();
        if (user.state !== 'logged-in') {
          return;
        }

        await journalEntryManager.refresh(user, ctx.interests.visitor, {
          endpoint: screen.parameters.regenerate.endpoint,
          unsafeToRetry: false,
          bonusParams: async () => ({
            version: SCREEN_VERSION,
            entry_counter: summary.entryCounter,
          }),
          sticky: false,
        });
      },
      dispose: () => {
        setVWC(activeVWC, false);
        cleanupJournalEntryManagerRequester();
        cleanupJournalEntryManagerUnwrapper();
        cleanupJournalEntryJWTUnwrapper();
        cleanupChatUnwrapper();
        cleanupJournalEntryManagerRefresher();
        cleanupJournalEntryManagerRetrier();
      },
    };
  },
  component: (params) => <JournalEntrySummary {...params} />,
};
