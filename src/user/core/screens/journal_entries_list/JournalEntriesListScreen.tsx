import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../shared/lib/CancelablePromise';
import { constructCancelablePromise } from '../../../../shared/lib/CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from '../../../../shared/lib/createCancelablePromiseFromCallbacks';
import { createCancelableTimeout } from '../../../../shared/lib/createCancelableTimeout';
import { getCurrentServerTimeMS } from '../../../../shared/lib/getCurrentServerTimeMS';
import { getJwtExpiration } from '../../../../shared/lib/getJwtExpiration';
import { setVWC } from '../../../../shared/lib/setVWC';
import { waitForValueWithCallbacksConditionCancelable } from '../../../../shared/lib/waitForValueWithCallbacksCondition';
import { RequestResult } from '../../../../shared/requests/RequestHandler';
import { unwrapRequestResult } from '../../../../shared/requests/unwrapRequestResult';
import { OsehScreen } from '../../models/Screen';
import { JournalEntriesList } from './JournalEntriesList';
import {
  JournalEntriesListAPIParams,
  JournalEntriesListMappedParams,
  journalEntriesListParamsMapper,
} from './JournalEntriesListParams';
import { JournalEntriesListResources } from './JournalEntriesListResources';
import { JournalEntryListState } from './lib/createJournalEntryListRequestHandler';

/**
 * Allows the user to view their journal entries
 */
export const JournalEntriesListScreen: OsehScreen<
  'journal_entries_list',
  JournalEntriesListResources,
  JournalEntriesListAPIParams,
  JournalEntriesListMappedParams
> = {
  slug: 'journal_entries_list',
  paramMapper: (api) => convertUsingMapper(api, journalEntriesListParamsMapper),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const listRequestVWC =
      createWritableValueWithCallbacks<RequestResult<JournalEntryListState> | null>(null);

    // exclusive writer for listRequestVWC
    const cleanupListRequester = (() => {
      const active = createWritableValueWithCallbacks(true);

      updateListRequestLoop();
      return () => {
        setVWC(active, false);

        const old = listRequestVWC.get();
        if (old !== null) {
          old.release();
          setVWC(listRequestVWC, null);
        }
      };

      async function updateListRequestLoop() {
        const canceled = waitForValueWithCallbacksConditionCancelable(active, (v) => !v);

        while (true) {
          if (!active.get()) {
            return;
          }

          const userUnch = ctx.login.value.get();
          if (userUnch.state !== 'logged-in') {
            const userChanged = waitForValueWithCallbacksConditionCancelable(
              ctx.login.value,
              (v) => v.state === 'logged-in'
            );
            userChanged.promise.catch(() => {});
            listRequestVWC.get()?.release();
            setVWC(listRequestVWC, null);
            await Promise.race([canceled.promise, userChanged.promise]);
            userChanged.cancel();
            continue;
          }
          const user = userUnch;

          if (ctx.interests.visitor.value.get().loading) {
            const visitorChanged = waitForValueWithCallbacksConditionCancelable(
              ctx.interests.visitor.value,
              (v) => !v.loading
            );
            visitorChanged.promise.catch(() => {});
            listRequestVWC.get()?.release();
            setVWC(listRequestVWC, null);
            await Promise.race([canceled.promise, visitorChanged.promise]);
            visitorChanged.cancel();
            continue;
          }

          const existingRequest = listRequestVWC.get();
          if (existingRequest !== null) {
            const data = existingRequest.data.get();
            let expiresAtPromise: CancelablePromise<void> | undefined;
            if (data.type === 'success') {
              if (data.data.userSub !== user.userAttributes.sub) {
                existingRequest.release();
                setVWC(listRequestVWC, null);
                continue;
              }

              const serverNow = await getCurrentServerTimeMS();
              if (!active.get()) {
                continue;
              }
              if (
                !Object.is(ctx.login.value.get(), user) ||
                !Object.is(existingRequest.data.get(), data)
              ) {
                continue;
              }

              if (serverNow >= data.data.expiresAtServerMS) {
                data.reportExpired();
              } else {
                expiresAtPromise = createCancelableTimeout(data.data.expiresAtServerMS - serverNow);
                expiresAtPromise.promise.catch(() => {});
              }
            }

            const userChanged = waitForValueWithCallbacksConditionCancelable(
              ctx.login.value,
              (v) => !Object.is(v, user)
            );
            userChanged.promise.catch(() => {});
            const dataChanged = waitForValueWithCallbacksConditionCancelable(
              existingRequest.data,
              (d) => !Object.is(d, data)
            );
            dataChanged.promise.catch(() => {});
            await Promise.race([
              canceled.promise,
              userChanged.promise,
              dataChanged.promise,
              ...(expiresAtPromise === undefined ? [] : [expiresAtPromise.promise]),
            ]);
            userChanged.cancel();
            dataChanged.cancel();
            expiresAtPromise?.cancel();
            continue;
          }

          const newRequest = ctx.resources.journalEntryListHandler.request({
            ref: { user, visitor: ctx.interests.visitor },
            refreshRef: () =>
              constructCancelablePromise({
                body: async (state, resolve, reject) => {
                  const refreshAtServerMS = await getCurrentServerTimeMS();

                  const innerCanceled = createCancelablePromiseFromCallbacks(state.cancelers);
                  innerCanceled.promise.catch(() => {});
                  if (state.finishing) {
                    innerCanceled.cancel();
                    state.done = true;
                    reject(new Error('canceled'));
                    return;
                  }

                  if (!active.get()) {
                    innerCanceled.cancel();
                    state.finishing = true;
                    state.done = true;
                    reject(new Error('our ref is also expired'));
                    return;
                  }

                  const userIsUpdated = waitForValueWithCallbacksConditionCancelable(
                    ctx.login.value,
                    (v) =>
                      v.state === 'logged-out' ||
                      (v.state === 'logged-in' &&
                        (v.userAttributes.sub !== user.userAttributes.sub ||
                          getJwtExpiration(v.authTokens.idToken) > refreshAtServerMS))
                  );
                  userIsUpdated.promise.catch(() => {});
                  await Promise.race([
                    userIsUpdated.promise,
                    innerCanceled.promise,
                    canceled.promise,
                  ]);
                  userIsUpdated.cancel();
                  if (state.finishing) {
                    state.done = true;
                    reject(new Error('canceled'));
                    return;
                  }
                  if (!active.get()) {
                    state.finishing = true;
                    innerCanceled.cancel();
                    state.done = true;
                    reject(new Error('our ref is also expired'));
                    return;
                  }

                  const newUser = ctx.login.value.get();
                  if (newUser.state !== 'logged-in') {
                    innerCanceled.cancel();
                    state.finishing = true;
                    state.done = true;
                    reject(new Error('not logged in'));
                    return;
                  }

                  if (newUser.userAttributes.sub !== user.userAttributes.sub) {
                    innerCanceled.cancel();
                    state.finishing = true;
                    state.done = true;
                    reject(new Error('user changed'));
                    return;
                  }

                  state.finishing = true;
                  innerCanceled.cancel();
                  state.done = true;
                  resolve({
                    type: 'success',
                    data: { user: newUser, visitor: ctx.interests.visitor },
                    error: undefined,
                    retryAt: undefined,
                  });
                },
              }),
          });
          setVWC(listRequestVWC, newRequest);
        }
      }
    })();

    const [listVWC, cleanupListUnwrapper] = unwrapRequestResult(
      listRequestVWC,
      (d) => d.data,
      (d) => (d === null || d.type === 'loading' ? null : undefined)
    );

    return {
      ready: createWritableValueWithCallbacks(true),
      list: listVWC,
      dispose: () => {
        cleanupListRequester();
        cleanupListUnwrapper();
      },
    };
  },
  component: (props) => <JournalEntriesList {...props} />,
};
