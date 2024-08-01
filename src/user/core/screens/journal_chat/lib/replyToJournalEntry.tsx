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
import { SCREEN_VERSION } from '../../../../../shared/lib/screenVersion';

export type ReplyToJournalEntryStateSavingUserReply = {
  /**
   * - `saving-user-reply`: We are saving the user's reply in the backend
   */
  type: 'saving-user-reply';

  /** The journal entry within which we are saving the reply */
  journalEntryUID: string;

  /** The JWT that allows us to save the reply */
  journalEntryJWT: string;

  /** The client key we are trying to use to save the reply */
  clientKey: WrappedJournalClientKey;

  /** The fernet token containing the encrypted message */
  encryptedUserMessage: string;
};

export type ReplyToJournalEntryStateReadingSystemResponse = {
  /**
   * - `reading-system-response`: We successfully saved the users reply and
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

export type ReplyToJournalEntryStateDone = {
  /**
   * - `done`: We have successfully received the system response
   */
  type: 'done';

  /** The UID of the journal entry we created */
  journalEntryUID: string;
  /** The JWT that can be used to respond to the greeting once we have it */
  journalEntryJWT: string;
  /** the entire chat */
  conversation: JournalChatState;
};

export type ReplyToJournalEntryStateFailed = {
  /**
   * - `failed`: We failed to create the journal entry
   */
  type: 'failed';
  /** Where the error occurred */
  at: 'saving-user-reply' | 'reading-system-response';
  /** more detail about `at` */
  atUnstable: string;
  /** how we think this can be resolved */
  resolutionHint: 'regenerate-client-key' | 'retry' | 'contact-support';
  /** An element which can be used to render a human-readable description of the error */
  error: ReactElement;
};

export type ReplyToJournalEntryState =
  | ReplyToJournalEntryStateSavingUserReply
  | ReplyToJournalEntryStateReadingSystemResponse
  | ReplyToJournalEntryStateDone
  | ReplyToJournalEntryStateFailed;

export type ReplyToJournalEntryResult = {
  /** The current reply to journal entry state */
  state: ValueWithCallbacks<ReplyToJournalEntryState>;
  /** a cancelable promise for when we are done managing the state */
  handlerCancelable: CancelablePromise<void>;
};

/**
 * Adds the users reply to the journal entry and then waits for the system to
 * respond
 */
export const replyToJournalEntry = (
  user: LoginContextValueLoggedIn,
  journalEntryUID: string,
  journalEntryJWT: string,
  clientKey: WrappedJournalClientKey,
  /** The text that the user sent, without any preprocessing, encrypted */
  encryptedUserMessage: string
): ReplyToJournalEntryResult => {
  const result = createWritableValueWithCallbacks<ReplyToJournalEntryState>({
    type: 'saving-user-reply',
    journalEntryUID,
    journalEntryJWT,
    clientKey,
    encryptedUserMessage,
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
            at: 'saving-user-reply',
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

        const created = await saveJournalEntryUserReply(
          result,
          user,
          journalEntryUID,
          journalEntryJWT,
          clientKey,
          encryptedUserMessage,
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

const saveJournalEntryUserReply = async (
  result: WritableValueWithCallbacks<ReplyToJournalEntryState>,
  user: LoginContextValueLoggedIn,
  journalEntryUID: string,
  journalEntryJWT: string,
  clientKey: WrappedJournalClientKey,
  /** The text that the user sent, without any preprocessing, encrypted */
  encryptedUserMessage: string,
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
      '/api/1/journals/entries/chat/',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          platform: VISITOR_SOURCE,
          version: SCREEN_VERSION,
          journal_entry_uid: journalEntryUID,
          journal_entry_jwt: journalEntryJWT,
          journal_client_key_uid: clientKey.uid,
          encrypted_user_message: encryptedUserMessage,
        }),
        signal,
      },
      user
    );
  } catch (e) {
    if (state.finishing) {
      setVWC(result, {
        type: 'failed',
        at: 'saving-user-reply',
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
      at: 'saving-user-reply',
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
      at: 'saving-user-reply',
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
        at: 'saving-user-reply',
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
      at: 'saving-user-reply',
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
