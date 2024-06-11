import { ReactElement, useCallback, useContext, useEffect, useMemo } from 'react';
import { PeekedScreen } from '../models/Screen';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { Result } from '../../../shared/requests/RequestHandler';
import { LoginContext, LoginContextValueLoggedIn } from '../../../shared/contexts/LoginContext';
import { InterestsContext } from '../../../shared/contexts/InterestsContext';
import { constructCancelablePromise } from '../../../shared/lib/CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from '../../../shared/lib/createCancelablePromiseFromCallbacks';
import { VisitorValue } from '../../../shared/hooks/useVisitorValueWithCallbacks';
import { waitForValueWithCallbacksConditionCancelable } from '../../../shared/lib/waitForValueWithCallbacksCondition';
import { delayCancelableUntilResolved } from '../../../shared/lib/delayCancelableUntilResolved';
import { apiFetch } from '../../../shared/ApiConstants';
import { VISITOR_SOURCE } from '../../../shared/lib/visitorSource';
import { describeErrorFromResponse, describeFetchError } from '../../../shared/forms/ErrorBlock';
import { setVWC } from '../../../shared/lib/setVWC';

export type UseScreenQueueStateResult = {
  /** The screen that the user should see */
  active: PeekedScreen<string, any>;
  /** The JWT to use for peeking or popping the active screen */
  activeJwt: string;
  /** Screens that are likely to be shown very soon and should have their resources fetched */
  prefetch: PeekedScreen<string, any>[];
};

export type UseScreenQueueStateState =
  | {
      /**
       * - `loading`: waiting on the response of a peek or pop
       */
      type: 'loading';
      error?: undefined;
      result?: undefined;
    }
  | {
      /**
       * - `error`: something went wrong
       */
      type: 'error';
      /** A description of what went wrong */
      error: ReactElement;
      result?: undefined;
    }
  | {
      /**
       * - `success`: the active screen and the screens to prefetch
       */
      type: 'success';
      error?: undefined;
      /** The active screen and the screens to prefetch */
      result: UseScreenQueueStateResult;
    };

export type ScreenQueueState = {
  /** The current state */
  value: ValueWithCallbacks<UseScreenQueueStateState>;
  /**
   * Refreshes the current state by peeking it again. This will update
   * the value before the promise resolves. Other peek or pop operations
   * should be canceled before calling this.
   */
  peek: () => CancelablePromise<Result<UseScreenQueueStateState>>;

  /**
   * Stores trace information for the current screen.
   */
  trace: (from: UseScreenQueueStateState & { type: 'success' }, event: object) => void;

  /**
   * Pops the current screen from the queue, optionally triggers a client
   * flow with the given slug and parameters, and returns the new state.
   * Other peek or pop operations should be canceled before calling this.
   *
   * @param from The current state
   * @param trigger The trigger to execute
   * @param endpoint usually /api/1/users/me/screens/pop
   * @param onError If specified, instead of transitioning to the error state if the pop
   *   fails, we call this function with the error and keep the current state.
   */
  pop: (
    from: UseScreenQueueStateState & { type: 'success' },
    trigger: { slug: string; parameters: any } | null,
    endpoint: string,
    onError?: (error: unknown) => void
  ) => CancelablePromise<Result<UseScreenQueueStateState>>;
};

/**
 * A hook for managing the authorized users' client screen queue. Requires a
 * LoginContext and InterestsContext is available, and immediately starts a peek
 * operation.
 */
export const useScreenQueueState = (): ScreenQueueState => {
  const loginContextRaw = useContext(LoginContext);
  const interestsContext = useContext(InterestsContext);

  const valueVWC = useWritableValueWithCallbacks<UseScreenQueueStateState>(() => ({
    type: 'loading',
  }));

  const prepare = useCallback(
    (): CancelablePromise<{
      loginContext: LoginContextValueLoggedIn;
      visitor: VisitorValue & { loading: false };
    }> =>
      constructCancelablePromise({
        body: async (state, resolve, reject) => {
          const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
          canceled.promise.catch(() => {});
          if (state.finishing) {
            canceled.cancel();
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          const loginContextCancelable = waitForValueWithCallbacksConditionCancelable(
            loginContextRaw.value,
            (v) => v.state !== 'loading'
          );

          const visitorCancelable = waitForValueWithCallbacksConditionCancelable(
            interestsContext.visitor.value,
            (v) => !v.loading
          );

          const readyPromise = Promise.all([
            loginContextCancelable.promise,
            visitorCancelable.promise,
          ]);

          await Promise.race([readyPromise, canceled.promise]);

          if (state.finishing) {
            canceled.cancel();
            visitorCancelable.cancel();
            loginContextCancelable.cancel();
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          const [loginContext, visitor] = await readyPromise;
          if (state.finishing) {
            canceled.cancel();
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          if (loginContext.state !== 'logged-in') {
            canceled.cancel();
            state.finishing = true;
            state.done = true;
            reject(new Error('not logged in'));
            return;
          }

          if (visitor.loading) {
            canceled.cancel();
            state.finishing = true;
            state.done = true;
            reject(new Error('impossible'));
            return;
          }

          state.finishing = true;
          state.done = true;
          resolve({ loginContext, visitor });
        },
      }),
    [loginContextRaw, interestsContext.visitor]
  );

  const peekLike = useCallback(
    ({
      path,
      headers,
      body,
      onError,
    }: {
      path: string;
      headers: Headers | undefined;
      body: BodyInit | undefined;
      onError?: (error: unknown) => void;
    }): CancelablePromise<Result<UseScreenQueueStateState>> =>
      delayCancelableUntilResolved(
        ({ loginContext, visitor }) =>
          constructCancelablePromise({
            body: async (state, resolve, reject) => {
              const controller = new AbortController();
              const signal = controller.signal;
              const doAbort = () => controller.abort();
              state.cancelers.add(doAbort);
              if (state.finishing) {
                state.cancelers.remove(doAbort);
                state.done = true;
                reject(new Error('canceled'));
                return;
              }

              const oldValue = valueVWC.get();
              setVWC(valueVWC, { type: 'loading' }, (a, b) => a.type === b.type);

              const fullHeaders = new Headers(headers);
              if (visitor.uid !== null) {
                fullHeaders.set('visitor', visitor.uid);
              }

              let response: Response;
              try {
                response = await apiFetch(
                  `${path}?platform=${encodeURIComponent(VISITOR_SOURCE)}`,
                  {
                    method: 'POST',
                    headers: fullHeaders,
                    body,
                    signal,
                  },
                  loginContext
                );
              } catch (e) {
                state.cancelers.remove(doAbort);
                if (onError === undefined) {
                  const result: UseScreenQueueStateState = {
                    type: 'error',
                    error: describeFetchError(),
                  };
                  setVWC(valueVWC, result);
                  state.finishing = true;
                  state.done = true;
                  resolve({
                    type: 'error',
                    data: undefined,
                    error: result.error,
                    retryAt: undefined,
                  });
                } else {
                  setVWC(valueVWC, oldValue);
                  onError(e);
                  state.finishing = true;
                  state.done = true;
                  resolve({
                    type: 'error',
                    data: undefined,
                    error: describeHandledError(),
                    retryAt: undefined,
                  });
                }
                return;
              }

              if (state.finishing) {
                state.cancelers.remove(doAbort);
                state.done = true;
                reject(new Error('canceled'));
                return;
              }

              if (!response.ok) {
                if (onError !== undefined) {
                  state.cancelers.remove(doAbort);
                  setVWC(valueVWC, oldValue);
                  onError(response);
                  state.finishing = true;
                  state.done = true;
                  resolve({
                    type: 'error',
                    data: undefined,
                    error: describeHandledError(),
                    retryAt: undefined,
                  });
                  return;
                }

                const described = await describeErrorFromResponse(response);
                state.cancelers.remove(doAbort);

                if (state.finishing) {
                  state.done = true;
                  reject(new Error('canceled'));
                  return;
                }

                let retryAfterSeconds: number | undefined = undefined;
                try {
                  const retryAfter = response.headers.get('Retry-After');
                  if (retryAfter !== null && retryAfter !== '') {
                    const parsed = parseInt(retryAfter, 10);
                    if (parsed > 0) {
                      retryAfterSeconds = parsed;
                    }
                  }
                } catch (e) {
                  // ignore
                }

                if (retryAfterSeconds === undefined && response.status === 503) {
                  retryAfterSeconds = 5;
                }

                state.finishing = true;
                const result: UseScreenQueueStateState = { type: 'error', error: described };
                setVWC(valueVWC, result);
                state.done = true;
                if (retryAfterSeconds !== undefined) {
                  resolve({
                    type: 'errorRetryable',
                    data: undefined,
                    error: described,
                    retryAt: new Date(Date.now() + retryAfterSeconds * 1000),
                  });
                } else {
                  resolve({ type: 'error', data: undefined, error: described, retryAt: undefined });
                }
                return;
              }

              let data: {
                visitor: string;
                screen: {
                  active: {
                    slug: string;
                    parameters: any;
                  };
                  active_jwt: string;
                  prefetch: {
                    slug: string;
                    parameters: any;
                  }[];
                };
              };

              try {
                data = await response.json();
              } catch (e) {
                state.cancelers.remove(doAbort);

                if (onError !== undefined) {
                  setVWC(valueVWC, oldValue);
                  onError(e);
                  state.finishing = true;
                  state.done = true;
                  resolve({
                    type: 'error',
                    data: undefined,
                    error: describeHandledError(),
                    retryAt: undefined,
                  });
                  return;
                }

                const result: UseScreenQueueStateState = {
                  type: 'error',
                  error: describeFetchError(),
                };
                setVWC(valueVWC, result);
                state.finishing = true;
                state.done = true;
                resolve({
                  type: 'error',
                  data: undefined,
                  error: result.error,
                  retryAt: undefined,
                });
                return;
              }

              state.cancelers.remove(doAbort);

              if (state.finishing) {
                state.done = true;
                reject(new Error('canceled'));
                return;
              }

              const newVisitorUid = data.visitor;
              if (newVisitorUid !== visitor.uid) {
                interestsContext.visitor.setVisitor(newVisitorUid);
              }

              const active: PeekedScreen<string, any> = {
                slug: data.screen.active.slug,
                parameters: data.screen.active.parameters,
              };

              const prefetch: PeekedScreen<string, any>[] = data.screen.prefetch.map((p) => ({
                slug: p.slug,
                parameters: p.parameters,
              }));

              state.finishing = true;
              const result: UseScreenQueueStateState = {
                type: 'success',
                result: { active, activeJwt: data.screen.active_jwt, prefetch },
              };
              setVWC(valueVWC, result);
              state.done = true;
              resolve({ type: 'success', data: result, error: undefined, retryAt: undefined });
            },
          }),
        prepare()
      ),
    [prepare, interestsContext.visitor, valueVWC]
  );

  const peek = useCallback(
    () => peekLike({ path: '/api/1/users/me/screens/peek', headers: undefined, body: undefined }),
    [peekLike]
  );

  const pop = useCallback(
    (
      from: UseScreenQueueStateState & { type: 'success' },
      trigger: { slug: string; parameters: any } | null,
      endpoint: string,
      onError?: (error: unknown) => void
    ) =>
      peekLike({
        path: endpoint,
        headers: new Headers({
          'Content-Type': 'application/json; charset=utf-8',
        }),
        body: JSON.stringify({
          screen_jwt: from.result.activeJwt,
          ...(trigger === null ? {} : { trigger }),
        }),
        onError,
      }),
    [peekLike]
  );

  const trace = useCallback(
    (from: UseScreenQueueStateState & { type: 'success' }, event: object) => {
      apiFetch(
        `/api/1/users/me/screens/trace?platform=${encodeURIComponent(VISITOR_SOURCE)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: `bearer ${from.result.activeJwt}`,
          },
          body: JSON.stringify(event),
          keepalive: true,
        },
        null
      ).catch((e) => {
        console.debug('trace failed', e);
      });
    },
    []
  );

  /** WEB ONLY: First peek might have a merge token, checkout session id, or link code */
  const peekFirst = useCallback(() => {
    let result = handleMergeToken();
    if (result !== null) {
      return result;
    }
    result = handleCheckoutSession();
    if (result !== null) {
      return result;
    }
    /* TODO /l/* and /a/* links */
    return peek();

    function handleMergeToken(): CancelablePromise<Result<UseScreenQueueStateState>> | null {
      const fragment = window.location.hash;
      if (fragment.length === 0) {
        return null;
      }

      const args = new URLSearchParams(fragment.substring(1));
      if (!args.has('merge_token')) {
        return null;
      }

      const mergeToken = args.get('merge_token');
      if (mergeToken === null || mergeToken.length < 3) {
        return null;
      }

      const result = peekLike({
        path: '/api/1/users/me/screens/empty_with_merge_token',
        headers: new Headers({
          'Content-Type': 'application/json; charset=utf-8',
        }),
        body: JSON.stringify({ merge_token: mergeToken }),
      });
      return {
        promise: result.promise.then((r) => {
          const fragment = window.location.hash;
          if (fragment.length < 1) {
            return r;
          }
          const args = new URLSearchParams(fragment.substring(1));
          if (!args.has('merge_token')) {
            return r;
          }

          args.delete('merge_token');
          window.history.replaceState(
            {},
            document.title,
            `${window.location.pathname}${window.location.search}#${args.toString()}`
          );

          return r;
        }),
        done: result.done,
        cancel: result.cancel,
      };
    }

    function handleCheckoutSession(): CancelablePromise<Result<UseScreenQueueStateState>> | null {
      const query = window.location.search;
      if (query.length === 0) {
        return null;
      }

      const args = new URLSearchParams(query.substring(1));
      if (!args.has('checkout_uid')) {
        return null;
      }

      const checkoutUid = args.get('checkout_uid');
      if (checkoutUid === null || checkoutUid.length < 3) {
        return null;
      }

      const result = peekLike({
        path: '/api/1/users/me/screens/empty_with_checkout_uid',
        headers: new Headers({
          'Content-Type': 'application/json; charset=utf-8',
        }),
        body: JSON.stringify({ checkout_uid: checkoutUid }),
      });
      return {
        promise: result.promise.then((r) => {
          const query = window.location.search;
          if (query.length < 1) {
            return r;
          }
          const args = new URLSearchParams(query.substring(1));
          if (!args.has('checkout_uid')) {
            return r;
          }

          args.delete('checkout_uid');
          args.delete('checkout_success');
          window.history.replaceState(
            {},
            document.title,
            `${window.location.pathname}?${args.toString()}${window.location.hash}`
          );
          return r;
        }),
        done: result.done,
        cancel: result.cancel,
      };
    }
  }, [peek, peekLike]);

  useEffect(() => {
    const peeker = peekFirst();
    peeker.promise.catch((e) => {
      if (
        e instanceof Error &&
        (e.message.startsWith('canceled') || e.message.includes('not logged in'))
      ) {
        return;
      }
      console.error(e);
    });
    return peeker.cancel;
  }, [peek, peekFirst]);

  return useMemo(() => ({ value: valueVWC, peek, trace, pop }), [valueVWC, peek, trace, pop]);
};

function describeHandledError(): ReactElement {
  return <>An error occurred and an error handler was specified. You should not see this.</>;
}
