// 'creating-entry' |'reading-greeting' | 'done' | 'failed';

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

export type StartJournalEntryStateCreatingEntry = {
  /**
   * - `creating-entry`: We have not yet created the journal entry as we haven't received the
   *   response from `POST /api/1/journals/entries/`
   */
  type: 'creating-entry';
};

export type StartJournalEntryStateReadingGreeting = {
  /**
   * - `reading-greeting`: We successfully created the journal entry
   *   and received the required keys to receive the greeting from `WS /api/2/journals/chat/`.
   *   We are managing the websocket loop, which may involve reconnects
   */
  type: 'reading-greeting';

  /** The JWT are using to connect to the websocket endpoint */
  journalChatJWT: string;
  /** The UID of the journal entry we created */
  journalEntryUID: string;
  /** The JWT that can be used to respond to the greeting once we have it */
  journalEntryJWT: string;

  /**
   * The current journal chat state, which may update multiple times as the
   * server is allowed to give us partial views, out of order updates, or
   * even rewrite previously sent text
   */
  chat: ValueWithCallbacks<JournalChatState>;
};

export type StartJournalEntryStateDone = {
  /**
   * - `done`: We have successfully received the greeting and the user can
   *   provide their response
   */
  type: 'done';

  /** The UID of the journal entry we created */
  journalEntryUID: string;
  /** The JWT that can be used to respond to the greeting once we have it */
  journalEntryJWT: string;
  /** the state of the journal after the systems greeting */
  greeting: JournalChatState;
};

export type StartJournalEntryStateFailed = {
  /**
   * - `failed`: We failed to create the journal entry
   */
  type: 'failed';
  /** Where the error occurred */
  at: 'create' | 'read-greeting';
  /** more detail about `at` */
  atUnstable: string;
  /** how we think this can be resolved */
  resolutionHint: 'regenerate-client-key' | 'retry' | 'contact-support';
  /** An element which can be used to render a human-readable description of the error */
  error: ReactElement;
};

export type StartJournalEntryState =
  | StartJournalEntryStateCreatingEntry
  | StartJournalEntryStateReadingGreeting
  | StartJournalEntryStateDone
  | StartJournalEntryStateFailed;

export type StartJournalEntryResult = {
  /** The current start journal entry state */
  state: ValueWithCallbacks<StartJournalEntryState>;
  /** a cancelable promise for when we are done managing the state */
  handlerCancelable: CancelablePromise<void>;
};

/**
 * Starts a journal entry and retrieves a new system greeting. This can
 * take some time, and the intermediary state is provided via `state`.
 * To wait until we reach a terminal state, or to cancel further processing,
 * use `handlerCancelable`.
 */
export const startJournalEntry = (
  user: LoginContextValueLoggedIn,
  clientKey: WrappedJournalClientKey
): StartJournalEntryResult => {
  const result = createWritableValueWithCallbacks<StartJournalEntryState>({
    type: 'creating-entry',
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
            at: 'create',
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

        const created = await createJournalEntry(result, user, clientKey, state, reject, signal);
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
            at: 'read-greeting',
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
          type: 'reading-greeting',
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
          state.finishing = true;
          setVWC(result, {
            type: 'failed',
            at: 'read-greeting',
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
          greeting: chat.get(),
        });
        state.done = true;
        resolve();
      },
    }),
  };
};

const createJournalEntry = async (
  result: WritableValueWithCallbacks<StartJournalEntryState>,
  user: LoginContextValueLoggedIn,
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
      '/api/1/journals/entries/',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          platform: VISITOR_SOURCE,
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
        at: 'create',
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
      at: 'create',
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
      at: 'create',
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
    reject(`create journal entry - ${response.status}: ${response.statusText}`);
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
        at: 'create',
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
      at: 'create',
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
