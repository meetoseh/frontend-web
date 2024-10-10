import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { LoginContextValueLoggedIn } from '../../../../shared/contexts/LoginContext';
import { createValuesWithCallbacksEffect } from '../../../../shared/hooks/createValuesWithCallbacksEffect';
import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { Visitor } from '../../../../shared/hooks/useVisitorValueWithCallbacks';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../shared/lib/CancelablePromise';
import { getCurrentServerTimeMS } from '../../../../shared/lib/getCurrentServerTimeMS';
import { mapCancelable } from '../../../../shared/lib/mapCancelable';
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
  JournalEntryMetadata,
  JournalEntryMetadataRef,
} from '../journal_chat/lib/createJournalEntryMetadataRequestHandler';
import { JournalChatState } from '../journal_chat/lib/JournalChatState';
import { JournalEntryView } from './JournalEntryView';
import { JournalEntryViewAPIParams, JournalEntryViewMappedParams } from './JournalEntryViewParams';
import { JournalEntryViewResources } from './JournalEntryViewResources';

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

    const getJournalEntryManager = (): RequestResult<JournalEntryManager> => {
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
                error: <>Screen is not mounted</>,
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
                error: <>User is not logged in</>,
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
                error: <>Visitor is not loaded</>,
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
                error: <>JWT is not loaded</>,
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
                    error: <>Journal entry not provided by server</>,
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
        cleanupJournalEntryJWTUnwrapper();
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
