import { ReactElement } from 'react';
import {
  createWritableValueWithCallbacks,
  ValueWithCallbacks,
  WritableValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { computeJournalChatStateDataIntegrity, JournalChatState } from './JournalChatState';
import { CancelablePromise } from '../../../../../shared/lib/CancelablePromise';
import { LoginContextValueLoggedIn } from '../../../../../shared/contexts/LoginContext';
import {
  CancelablePromiseState,
  constructCancelablePromise,
} from '../../../../../shared/lib/CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from '../../../../../shared/lib/createCancelablePromiseFromCallbacks';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { setVWC } from '../../../../../shared/lib/setVWC';
import { WrappedJournalClientKey } from '../../../../../shared/journals/clientKeys';
import { VISITOR_SOURCE } from '../../../../../shared/lib/visitorSource';
import {
  describeError,
  describeErrorFromResponse,
  describeFetchError,
} from '../../../../../shared/forms/ErrorBlock';
import { manageWebsocketChatLoop } from './manageWebsocketChatLoop';

export type SyncToJournalEntryStateSavingUserReply = {
  /**
   * - `requesting-sync`: We are requesting a sync job be created on the backend
   */
  type: 'requesting-sync';

  /** The journal entry within which we are syncing */
  journalEntryUID: string;

  /** The JWT that allows us to sync */
  journalEntryJWT: string;

  /** The client key we are trying to use to save the reply */
  clientKey: WrappedJournalClientKey;
};

export type SyncToJournalEntryStateReadingSystemResponse = {
  /**
   * - `reading-system-response`: We successfully started the job and
   *   are now trying to get the reply from the system
   */
  type: 'reading-system-response';

  /** The JWT are using to connect to the websocket endpoint */
  journalChatJWT: string;
  /** The UID of the journal entry the response was saved to */
  journalEntryUID: string;
  /** The refreshed JWT for responding to the journal entry */
  journalEntryJWT: string;

  /**
   * The current journal chat state, which may update multiple times as the
   * server is allowed to give us partial views, out of order updates, or
   * even rewrite previously sent text
   */
  chat: ValueWithCallbacks<JournalChatState>;
};

export type SyncToJournalEntryStateDone = {
  /**
   * - `done`: We have successfully received the system response
   */
  type: 'done';

  /** The UID of the journal entry we synced with */
  journalEntryUID: string;
  /** The JWT that can be used to respond or sync again */
  journalEntryJWT: string;
  /** the entire chat state */
  conversation: JournalChatState;
};

export type SyncToJournalEntryStateFailed = {
  /**
   * - `failed`: We failed to sync the journal entry
   */
  type: 'failed';
  /** Where the error occurred */
  at: 'requesting-sync' | 'reading-system-response';
  /** more detail about `at` */
  atUnstable: string;
  /** how we think this can be resolved */
  resolutionHint: 'regenerate-client-key' | 'retry' | 'contact-support';
  /** An element which can be used to render a human-readable description of the error */
  error: ReactElement;
};

export type SyncToJournalEntryState =
  | SyncToJournalEntryStateSavingUserReply
  | SyncToJournalEntryStateReadingSystemResponse
  | SyncToJournalEntryStateDone
  | SyncToJournalEntryStateFailed;

export type SyncToJournalEntryResult = {
  /** The current reply to journal entry state */
  state: ValueWithCallbacks<SyncToJournalEntryState>;
  /** a cancelable promise for when we are done managing the state */
  handlerCancelable: CancelablePromise<void>;
};

/**
 * Streams the state of the given journal entry from the server.
 */
export const syncToJournalEntry = (
  user: LoginContextValueLoggedIn,
  journalEntryUID: string,
  journalEntryJWT: string,
  clientKey: WrappedJournalClientKey
): SyncToJournalEntryResult => {
  const result = createWritableValueWithCallbacks<SyncToJournalEntryState>({
    type: 'requesting-sync',
    journalEntryUID,
    journalEntryJWT,
    clientKey,
  });

  return {
    state: result,
    handlerCancelable: constructCancelablePromise({
      body: async (state, resolve, reject) => {
        const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
        canceled.promise.catch(() => {});
        if (state.finishing) {
          canceled.cancel();
          setVWC(result, {
            type: 'failed',
            at: 'requesting-sync',
            atUnstable: 'initialize',
            error: <>canceled</>,
            resolutionHint: 'retry',
          });
          state.done = true;
          reject(new Error('canceled'));
          return null;
        }
        const controller = new AbortController();
        const signal = controller.signal;
        const doAbort = () => controller.abort();
        state.cancelers.add(doAbort);

        const created = await startSyncJournalEntry(
          result,
          user,
          journalEntryUID,
          journalEntryJWT,
          clientKey,
          state,
          reject,
          signal
        );
        if (created === null) {
          canceled.cancel();
          state.cancelers.remove(doAbort);
          return;
        }

        const initialState: JournalChatState = {
          uid: created.journalEntryUID,
          integrity: '',
          data: [],
          transient: null,
        };
        initialState.integrity = await computeJournalChatStateDataIntegrity(initialState);
        if (state.finishing) {
          canceled.cancel();
          state.cancelers.remove(doAbort);
          setVWC(result, {
            type: 'failed',
            at: 'reading-system-response',
            atUnstable: 'compute-initial-integrity',
            error: <>canceled</>,
            resolutionHint: 'retry',
          });
          state.done = true;
          reject(new Error('canceled'));
          return;
        }

        const chat = createWritableValueWithCallbacks<JournalChatState>(initialState);
        setVWC(result, {
          type: 'reading-system-response',
          ...created,
          chat,
        });

        const wsPromise = manageWebsocketChatLoop({
          clientKey,
          out: chat,
          journalChatJWT: created.journalChatJWT,
          journalEntryUID: created.journalEntryUID,
        });
        state.cancelers.add(wsPromise.cancel);
        if (state.finishing) {
          wsPromise.cancel();
        }
        try {
          await wsPromise.promise;
        } catch (e) {
          if (state.finishing) {
            setVWC(result, {
              type: 'failed',
              at: 'reading-system-response',
              atUnstable: 'websocket',
              error: <>canceled</>,
              resolutionHint: 'retry',
            });
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          state.finishing = true;
          setVWC(result, {
            type: 'failed',
            at: 'reading-system-response',
            atUnstable: 'websocket',
            error: await describeError(e),
            resolutionHint: 'contact-support',
          });
          state.done = true;
          reject(e);
          return;
        } finally {
          state.cancelers.remove(wsPromise.cancel);
        }

        state.finishing = true;
        setVWC(result, {
          type: 'done',
          journalEntryUID: created.journalEntryUID,
          journalEntryJWT: created.journalEntryJWT,
          conversation: chat.get(),
        });
        state.done = true;
        resolve();
      },
    }),
  };
};

const startSyncJournalEntry = async (
  result: WritableValueWithCallbacks<SyncToJournalEntryState>,
  user: LoginContextValueLoggedIn,
  journalEntryUID: string,
  journalEntryJWT: string,
  clientKey: WrappedJournalClientKey,
  state: CancelablePromiseState,
  reject: (e: any) => void,
  signal: AbortSignal
): Promise<{
  journalChatJWT: string;
  journalEntryUID: string;
  journalEntryJWT: string;
} | null> => {
  let response: Response;
  try {
    response = await apiFetch(
      '/api/1/journals/entries/sync',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          platform: VISITOR_SOURCE,
          journal_entry_uid: journalEntryUID,
          journal_entry_jwt: journalEntryJWT,
          journal_client_key_uid: clientKey.uid,
        }),
        signal,
      },
      user
    );
  } catch (e) {
    if (state.finishing) {
      setVWC(result, {
        type: 'failed',
        at: 'requesting-sync',
        atUnstable: 'request',
        error: <>canceled</>,
        resolutionHint: 'retry',
      });
      state.done = true;
      reject(new Error('canceled'));
      return null;
    }
    state.finishing = true;
    setVWC(result, {
      type: 'failed',
      at: 'requesting-sync',
      atUnstable: 'request',
      error: describeFetchError(),
      resolutionHint: 'retry',
    });
    state.done = true;
    reject(e);
    return null;
  }

  if (!response.ok) {
    state.finishing = true;
    setVWC(result, {
      type: 'failed',
      at: 'requesting-sync',
      atUnstable: 'request',
      error: await describeErrorFromResponse(response),
      resolutionHint:
        (
          {
            '401': 'retry',
            '403': 'retry',
            '404': 'regenerate-client-key',
            '422': 'contact-support',
            '429': 'retry',
            '502': 'retry',
            '503': 'retry',
          } as const
        )[response.status] ?? 'contact-support',
    });
    state.done = true;
    reject(`sync journal entry - ${response.status}: ${response.statusText}`);
    return null;
  }

  let data: {
    journal_chat_jwt: string;
    journal_entry_uid: string;
    journal_entry_jwt: string;
  };
  try {
    data = await response.json();
  } catch (e) {
    if (state.finishing) {
      setVWC(result, {
        type: 'failed',
        at: 'requesting-sync',
        atUnstable: 'request-data',
        error: <>canceled</>,
        resolutionHint: 'retry',
      });
      state.done = true;
      reject(new Error('canceled'));
      return null;
    }
    state.finishing = true;
    setVWC(result, {
      type: 'failed',
      at: 'requesting-sync',
      atUnstable: 'request-data',
      error: describeFetchError(),
      resolutionHint: 'retry',
    });
    state.done = true;
    reject(e);
    return null;
  }

  return {
    journalChatJWT: data.journal_chat_jwt,
    journalEntryUID: data.journal_entry_uid,
    journalEntryJWT: data.journal_entry_jwt,
  };
};
