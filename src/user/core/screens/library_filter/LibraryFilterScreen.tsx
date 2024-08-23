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
import { screenConfigurableTriggerMapper } from '../../models/ScreenConfigurableTrigger';
import { libraryFilterMapper } from '../library/lib/LibraryFilter';
import { InstructorListState } from './lib/createInstructorListRequestHandler';
import { LibraryFilterComponent } from './LibraryFilterComponent';
import { LibraryFilterAPIParams, LibraryFilterMappedParams } from './LibraryFilterParams';
import { LibraryFilterResources } from './LibraryFilterResources';

/**
 * Allows the user to update the filters for the library screen and, presumably,
 * return to the library screen
 */
export const LibraryFilterScreen: OsehScreen<
  'library_filter',
  LibraryFilterResources,
  LibraryFilterAPIParams,
  LibraryFilterMappedParams
> = {
  slug: 'library_filter',
  paramMapper: (params) => ({
    entrance: params.entrance,
    header: params.header,
    close: {
      variant: params.close.variant,
      trigger: convertUsingMapper(params.close.trigger, screenConfigurableTriggerMapper),
      exit: params.close.exit,
    },
    cta:
      params.cta === null || params.cta === undefined
        ? null
        : {
            text: params.cta.text,
            trigger: convertUsingMapper(params.cta.trigger, screenConfigurableTriggerMapper),
            exit: params.cta.exit,
          },
    filter: convertUsingMapper(params.filter, libraryFilterMapper),
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const instructorsListRequestVWC =
      createWritableValueWithCallbacks<RequestResult<InstructorListState> | null>(null);

    const [instructorListVWC, cleanupInstructorListUnwrapper] = unwrapRequestResult(
      instructorsListRequestVWC,
      (d) => d.data.listing,
      (d) => (d === null || d.type === 'loading' ? null : undefined)
    );

    const cleanupInstructorListRequester = (() => {
      const active = createWritableValueWithCallbacks(true);

      updateListRequestLoop();
      return () => {
        setVWC(active, false);

        const old = instructorsListRequestVWC.get();
        if (old !== null) {
          old.release();
          setVWC(instructorsListRequestVWC, null);
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
            instructorsListRequestVWC.get()?.release();
            setVWC(instructorsListRequestVWC, null);
            await Promise.race([canceled.promise, userChanged.promise]);
            userChanged.cancel();
            continue;
          }
          const user = userUnch;

          const existingRequest = instructorsListRequestVWC.get();
          if (existingRequest !== null) {
            const data = existingRequest.data.get();
            let expiresAtPromise: CancelablePromise<void> | undefined;
            if (data.type === 'success') {
              if (data.data.userSub !== user.userAttributes.sub) {
                await createCancelableTimeout(3000).promise;
                existingRequest.release();
                setVWC(instructorsListRequestVWC, null);
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

          const newRequest = ctx.resources.instructorsListHandler.request({
            ref: { user },
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
                    data: { user: newUser },
                    error: undefined,
                    retryAt: undefined,
                  });
                },
              }),
          });
          setVWC(instructorsListRequestVWC, newRequest);
        }
      }
    })();

    return {
      ready: createWritableValueWithCallbacks(true),
      instructors: instructorListVWC,
      dispose: () => {
        cleanupInstructorListUnwrapper();
        cleanupInstructorListRequester();
      },
    };
  },
  component: (props) => <LibraryFilterComponent {...props} />,
};
