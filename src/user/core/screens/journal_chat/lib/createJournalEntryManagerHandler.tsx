import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../../shared/lib/CancelablePromise';
import { LoginContextValueLoggedIn } from '../../../../../shared/contexts/LoginContext';
import { RequestHandler, Result } from '../../../../../shared/requests/RequestHandler';
import { describeError } from '../../../../../shared/forms/ErrorBlock';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import { JournalChatState } from './JournalChatState';
import { ReactElement } from 'react';
import { createMappedValueWithCallbacks } from '../../../../../shared/hooks/useMappedValueWithCallbacks';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { waitForValueWithCallbacksConditionCancelable } from '../../../../../shared/lib/waitForValueWithCallbacksCondition';
import { constructCancelablePromise } from '../../../../../shared/lib/CancelablePromiseConstructor';
import {
  getOrCreateClientKey,
  WrappedJournalClientKey,
} from '../../../../../shared/journals/clientKeys';
import { createValueWithCallbacksEffect } from '../../../../../shared/hooks/createValueWithCallbacksEffect';
import { manageWebsocketChatLoop } from './manageWebsocketChatLoop';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { VISITOR_SOURCE } from '../../../../../shared/lib/visitorSource';
import { Visitor } from '../../../../../shared/hooks/useVisitorValueWithCallbacks';
import { createFernet } from '../../../../../shared/lib/fernet';
import { adaptCallbacksToAbortSignal } from '../../../../../shared/lib/adaptCallbacksToAbortSignal';
import { createCancelablePromiseFromCallbacks } from '../../../../../shared/lib/createCancelablePromiseFromCallbacks';
import { createCancelableTimeout } from '../../../../../shared/lib/createCancelableTimeout';

export type JournalEntryManagerRef = {
  /** The UID of the journal entry to get */
  journalEntryUID: string;

  /** The initial JWT to access the journal entry; might be updated while syncing */
  journalEntryJWT: string;
};

export type JournalEntryManagerMinimalRef = Pick<JournalEntryManagerRef, 'journalEntryUID'>;

export type JournalEntryManager = {
  /** The UID of the journal entry */
  journalEntryUID: string;

  /**
   * True if this object is disposed, false otherwise. Disposed objects will
   * not start new tasks
   */
  disposed: ValueWithCallbacks<boolean>;

  /**
   * The latest JWT that allows access to the journal entry; this can get
   * updated while refreshing, though it is not guarranteed to
   */
  journalEntryJWT: ValueWithCallbacks<string>;

  /**
   * The current state of the chat; null while initially loading, undefined if an
   * error occurred
   */
  chat: ValueWithCallbacks<JournalChatState | null | undefined>;

  /** The error preventing us from loading the chat, null otherwise */
  error: ValueWithCallbacks<ReactElement | null>;

  /**
   * The current task for loading the chat, or null if we are not actively
   * loading the chat
   */
  task: ValueWithCallbacks<CancelablePromise<void> | null>;

  /**
   * Starts a new task using the sync endpoint (or a sync-like endpoint, if a
   * different path is provided) using the latest user information
   *
   * A sync-like endpoint is any endpoint whose signature is compatible with
   * `/api/1/journals/entries/sync`
   */
  refresh: (
    user: LoginContextValueLoggedIn,
    visitor: Visitor,
    opts?: {
      endpoint?: string;
      bonusParams?: (clientKey: WrappedJournalClientKey) => Promise<object>;
      unsafeToRetry?: boolean;
    }
  ) => void;

  /**
   * Connects to the chat endpoint using an existing chat JWT to update the
   * chat state.
   *
   * This is primarily intended for when you are mutating the journal entry,
   * which will give back the new chat jwt from a non sync compatible endpoint
   * (usually because the thing you did is included in the request). The refresh
   * endpoint uses the sync endpoint then calls this under the hood.
   *
   * Sticky means that we will keep the current chat state if its successful until
   * we receive the first real set of mutations from the endpoint; not sticky means
   * we leave it blank until we receive the first real set of mutations. In either
   * case, the chat state isn't meaningfully updated until we get the first set of
   * mutations, so this is primarily a UI concern.
   *
   * CONCURRENCY: see `startTask`
   */
  attach: (
    journalChatJWT: string,
    clientKey: WrappedJournalClientKey,
    opts: { sticky: boolean }
  ) => void;

  /**
   * The underlying task that is started by the `attach` function. This is easier
   * to compose, but caution must be taken to ensure that it is only started via
   * startTask (generally, indirectly)
   */
  dangerousCreateAttachTask: (
    journalChatJWT: string,
    clientKey: WrappedJournalClientKey,
    opts: { sticky: boolean }
  ) => CancelablePromise<void>;

  /**
   * The underlying task that is started by the `refresh` function. This is easier
   * to compose, but caution must be taken to ensure that it is only started via
   * startTask (generally, indirectly)
   */
  dangerousCreateRefreshTask: (
    user: LoginContextValueLoggedIn,
    visitor: Visitor,
    opts?: {
      endpoint?: string;
      bonusParams?: (clientKey: WrappedJournalClientKey) => Promise<object>;
      unsafeToRetry?: boolean;
    }
  ) => CancelablePromise<void>;

  /**
   * Starts the given task such that it has exclusive access to write to the
   * chat state.
   *
   * CONCURRENCY:
   *   If this is called while a task is running, the task is canceled and this
   *   task at some point after the task resolves. If multiple tasks are in the
   *   queue, the order they are started is not necessarily fair, but only one
   *   will be started but not done() at a time. If the object is disposed
   *   before the task makes it to the front of the queue, the action will not
   *   be called. Otherwise, if there are multiple tasks in the queue, the task
   *   will be started and canceled immediately.
   *
   * @param action The action that wants write permission. It does not need to
   *   worry about `disposed` as it will be canceled when the object gets disposed
   * @returns A promise after the task finishes or we have decided not to start it
   */
  startTask: (
    action: (
      journalEntryJWT: WritableValueWithCallbacks<string>,
      chat: WritableValueWithCallbacks<JournalChatState | null | undefined>,
      error: WritableValueWithCallbacks<ReactElement | null>
    ) => CancelablePromise<void>
  ) => Promise<void>;

  /**
   * Returns true if the journal entry JWT we have is expried or the object is
   * disposed, false when as far as we know refreshing should work.
   */
  isExpiredOrDisposed: (nowServerMS: number) => boolean;

  /**
   * Disposes this object, if it isn't already disposed. Should almost never be
   * called externally; the RequestHandler will handle disposing objects that are
   * no longer referenced after they fall off the cache.
   */
  dispose: () => void;
};

/**
 * Creates a request handler for a journal entry manager, which is an
 * object that can load the state of a journal entry chat
 */
export const createJournalEntryManagerRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<JournalEntryManagerMinimalRef, JournalEntryManagerRef, JournalEntryManager> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
    cleanupData: (data) => data.dispose(),
  });
};

const getRefUid = (ref: JournalEntryManagerMinimalRef): string => ref.journalEntryUID;
const getDataFromRef = (
  ref: JournalEntryManagerRef
): CancelablePromise<Result<JournalEntryManager>> => {
  const state = createJournalEntryManager(ref);
  return {
    promise: Promise.resolve({
      type: 'success',
      data: state,
      error: undefined,
      retryAt: undefined,
    }),
    done: () => true,
    cancel: () => {},
  };
};
const compareRefs = (a: JournalEntryManagerRef, b: JournalEntryManagerRef): number =>
  getJwtExpiration(b.journalEntryJWT) - getJwtExpiration(a.journalEntryJWT);

/**
 * Creates an object that manages the state of a journal entry chat
 */
export const createJournalEntryManager = (initial: JournalEntryManagerRef): JournalEntryManager => {
  const journalEntryUID = initial.journalEntryUID;
  const disposedVWC = createWritableValueWithCallbacks(false);
  const journalEntryJWTVWC = createWritableValueWithCallbacks(initial.journalEntryJWT);
  const chatVWC = createWritableValueWithCallbacks<JournalChatState | null | undefined>(null);
  const errorVWC = createWritableValueWithCallbacks<ReactElement | null>(null);
  const taskVWC = createWritableValueWithCallbacks<CancelablePromise<void> | null>(null);

  const [journalEntryJWTExpiresAtVWC, cleanupJournalEntryJWTExpiresAt] =
    createMappedValueWithCallbacks(journalEntryJWTVWC, (jwt) => getJwtExpiration(jwt));

  const dispose = () => {
    setVWC(disposedVWC, true);
    taskVWC.get()?.cancel();
    cleanupJournalEntryJWTExpiresAt();
  };

  const startTask: JournalEntryManager['startTask'] = async (action) => {
    if (disposedVWC.get()) {
      return;
    }

    const isDisposedCancelable = waitForValueWithCallbacksConditionCancelable(
      disposedVWC,
      (v) => v
    );
    isDisposedCancelable.promise.catch(() => {});

    while (true) {
      const task = taskVWC.get();
      if (task === null) {
        break;
      }

      const taskChangedPromise = waitForValueWithCallbacksConditionCancelable(
        taskVWC,
        (v) => !Object.is(v, task)
      );
      taskChangedPromise.promise.catch(() => {});

      task.cancel();
      try {
        await Promise.race([
          isDisposedCancelable.promise,
          task.promise,
          taskChangedPromise.promise,
        ]);
      } catch (e) {
        console.log('eating task error:', e);
      }

      taskChangedPromise.cancel();

      if (disposedVWC.get()) {
        return;
      }

      if (Object.is(taskVWC.get(), task)) {
        break;
      }
    }

    isDisposedCancelable.cancel();

    let newTask;
    try {
      newTask = action(journalEntryJWTVWC, chatVWC, errorVWC);
    } catch (e) {
      newTask = constructCancelablePromise<void>({
        body: async (state, resolve, reject) => {
          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          const described = await describeError(e);
          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          setVWC(errorVWC, described);
          setVWC(chatVWC, undefined);
          state.finishing = true;
          state.done = true;
          resolve();
        },
      });
    }

    taskVWC.set(newTask);
    taskVWC.callbacks.call(undefined);

    try {
      await newTask.promise;
    } catch (e) {
      if (!disposedVWC.get()) {
        console.trace('journal entry manager task error:', e);
      }
    } finally {
      if (Object.is(taskVWC.get(), newTask)) {
        taskVWC.set(null);
        taskVWC.callbacks.call(undefined);
      }
    }
  };
  const dangerousCreateAttachTask: JournalEntryManager['dangerousCreateAttachTask'] = (
    journalChatJWT,
    clientKey,
    opts
  ): CancelablePromise<void> => {
    return constructCancelablePromise({
      body: async (state, resolve, reject) => {
        if (state.finishing) {
          state.done = true;
          reject(new Error('canceled'));
          return;
        }

        setVWC(errorVWC, null);

        const initialState: JournalChatState = {
          uid: journalEntryUID,
          integrity: '',
          data: [],
          transient: null,
        };
        const myChatVWC = createWritableValueWithCallbacks<JournalChatState>(initialState);

        const stickyChat = opts.sticky ? chatVWC.get() ?? null : null;
        const cleanupChatAttacher = createValueWithCallbacksEffect(myChatVWC, (myChat) => {
          if (stickyChat !== null && myChat.data.length === 0) {
            setVWC(
              chatVWC,
              {
                ...stickyChat,
                transient: myChat.transient,
              },
              () => false
            );
          } else {
            setVWC(chatVWC, myChat);
          }
          return undefined;
        });
        state.cancelers.add(cleanupChatAttacher);
        const wsPromise = manageWebsocketChatLoop({
          clientKey,
          out: myChatVWC,
          journalChatJWT: journalChatJWT,
          journalEntryUID: journalEntryUID,
        });
        state.cancelers.add(wsPromise.cancel);

        if (state.finishing) {
          console.warn(
            'unsafe state.finishing without yield - this is a bug, but we can probably recover'
          );
          wsPromise.cancel();
        }

        try {
          await wsPromise.promise;
        } catch (e) {
          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }
          const described = await describeError(e);
          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          console.warn('JournalEntryManager error in manageWebsocketLoop:', e);
          setVWC(errorVWC, described);
          setVWC(chatVWC, undefined);
          return;
        } finally {
          cleanupChatAttacher();
          state.cancelers.remove(cleanupChatAttacher);
          state.cancelers.remove(wsPromise.cancel);
        }

        if (state.finishing) {
          state.done = true;
          reject(new Error('canceled'));
        } else {
          state.finishing = true;
          setVWC(chatVWC, myChatVWC.get());
          state.done = true;
          resolve();
        }
      },
    });
  };
  const attach: JournalEntryManager['attach'] = (journalChatJWT, clientKey, opts) => {
    startTask(() => dangerousCreateAttachTask(journalChatJWT, clientKey, opts));
  };

  const dangerousCreateRefreshTask: JournalEntryManager['dangerousCreateRefreshTask'] = (
    user,
    visitor,
    opts
  ) => {
    return constructCancelablePromise({
      body: async (state, resolve, reject) => {
        if (state.finishing) {
          state.done = true;
          reject(new Error('canceled'));
          return;
        }

        setVWC(errorVWC, null);
        const clientKeyRaw = await getOrCreateClientKey(user, visitor);
        if (state.finishing) {
          state.done = true;
          reject(new Error('canceled'));
          return;
        }
        const clientKey: WrappedJournalClientKey = {
          uid: clientKeyRaw.uid,
          key: await createFernet(clientKeyRaw.key),
        };
        if (state.finishing) {
          state.done = true;
          reject(new Error('canceled'));
          return;
        }
        const bonusParams = await (opts?.bonusParams ?? (async () => ({})))(clientKey);
        const realEndpoint = opts?.endpoint ?? '/api/1/journals/entries/sync';
        let data;
        try {
          for (let i = 0; ; i++) {
            if (state.finishing) {
              state.done = true;
              reject(new Error('canceled'));
              return;
            }

            if (i > 3) {
              throw new Error('too many retries');
            }

            if (i > 0) {
              const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
              canceled.promise.catch(() => {});
              if (state.finishing) {
                canceled.cancel();
                state.done = true;
                reject(new Error('canceled'));
                return;
              }
              const timeout = createCancelableTimeout(1000 * Math.pow(2, i) + Math.random() * 500);
              timeout.promise.catch(() => {});
              await Promise.race([canceled.promise, timeout.promise]);
              canceled.cancel();
              timeout.cancel();

              if (state.finishing) {
                state.done = true;
                reject(new Error('canceled'));
                return;
              }
            }

            try {
              data = await adaptCallbacksToAbortSignal(state.cancelers, async (signal) => {
                const response = await apiFetch(
                  realEndpoint,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json; charset=utf-8',
                    },
                    body: JSON.stringify({
                      platform: VISITOR_SOURCE,
                      journal_entry_uid: journalEntryUID,
                      journal_entry_jwt: journalEntryJWTVWC.get(),
                      journal_client_key_uid: clientKey.uid,
                      ...bonusParams,
                    }),
                    signal,
                  },
                  user
                );
                if (!response.ok) {
                  throw response;
                }
                return (await response.json()) as {
                  journal_chat_jwt: string;
                  journal_entry_uid: string;
                  journal_entry_jwt: string;
                };
              });
              break;
            } catch (e) {
              if (e instanceof Response && e.status === 429 && !opts?.unsafeToRetry) {
                continue;
              }

              throw e;
            }
          }
        } catch (e) {
          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }
          const described = await describeError(e);
          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }
          console.warn(`JournalEntryManager error in starting sync via ${realEndpoint}:`, e);
          setVWC(errorVWC, described);
          setVWC(chatVWC, undefined);
          return;
        }

        if (state.finishing) {
          state.done = true;
          reject(new Error('canceled'));
          return;
        }

        setVWC(journalEntryJWTVWC, data.journal_entry_jwt);
        const attacher = dangerousCreateAttachTask(data.journal_chat_jwt, clientKey, {
          sticky: true,
        });
        state.cancelers.add(attacher.cancel);
        if (state.finishing) {
          attacher.cancel();
        }
        try {
          await attacher.promise;
          state.finishing = true;
          state.done = true;
          resolve();
        } catch (e) {
          state.finishing = true;
          state.done = true;
          reject(e);
        } finally {
          state.cancelers.remove(attacher.cancel);
        }
      },
    });
  };

  const refresh: JournalEntryManager['refresh'] = (user, visitor, opts) => {
    startTask(() => dangerousCreateRefreshTask(user, visitor, opts));
  };

  return {
    journalEntryUID,
    disposed: disposedVWC,
    journalEntryJWT: journalEntryJWTVWC,
    chat: chatVWC,
    error: errorVWC,
    task: taskVWC,
    refresh,
    attach,
    dangerousCreateAttachTask,
    dangerousCreateRefreshTask,
    startTask,
    isExpiredOrDisposed: (nowServerMS) =>
      disposedVWC.get() || journalEntryJWTExpiresAtVWC.get() < nowServerMS,
    dispose,
  };
};
