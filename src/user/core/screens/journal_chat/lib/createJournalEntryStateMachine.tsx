import {
  LoginContextValue,
  LoginContextValueLoggedIn,
} from '../../../../../shared/contexts/LoginContext';
import { Visitor } from '../../../../../shared/hooks/useVisitorValueWithCallbacks';
import {
  getOrCreateWrappedClientKey,
  WrappedJournalClientKey,
} from '../../../../../shared/journals/clientKeys';
import {
  createWritableValueWithCallbacks,
  ValueWithCallbacks,
  WritableValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../../../shared/lib/CancelablePromise';
import { constructCancelablePromise } from '../../../../../shared/lib/CancelablePromiseConstructor';
import { clearMessagesWithVWC } from '../../../../../shared/lib/clearMessagesWithVWC';
import { createCancelablePromiseFromCallbacks } from '../../../../../shared/lib/createCancelablePromiseFromCallbacks';
import { DisplayableError } from '../../../../../shared/lib/errors';
import { getCurrentServerTimeMS } from '../../../../../shared/lib/getCurrentServerTimeMS';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import { getLoggedInUserCancelable } from '../../../../../shared/lib/getLoggedInUserCancelable';
import { passMessageWithVWC } from '../../../../../shared/lib/passMessageWithVWC';
import { receiveMessageWithVWC } from '../../../../../shared/lib/receiveMessageWithVWC';
import { setVWC } from '../../../../../shared/lib/setVWC';
import {
  createSmartAPIFetch,
  createTypicalSmartAPIFetchMapper,
  SmartAPIFetch,
  SmartAPIFetchOptions,
} from '../../../../../shared/lib/smartApiFetch';
import {
  createSmartWebsocketConnect,
  SmartWebsocketConnect,
} from '../../../../../shared/lib/smartWebsocketConnect';
import { VISITOR_SOURCE } from '../../../../../shared/lib/visitorSource';
import { waitForValueWithCallbacksConditionCancelable } from '../../../../../shared/lib/waitForValueWithCallbacksCondition';
import {
  computeJournalChatStateDataIntegrity,
  JournalChatState,
  JournalChatTransientHint,
} from './JournalChatState';

/**
 * Previous states:
 * - none, this is an initial state
 * - `ready` (via `hard-refresh` message)
 *
 * Transitions:
 * - `preparing-references`: asap
 * - `released`: if a release message was already in the queue before dispatching the
 *   request
 */
export type StateInitializing = {
  /**
   * - `initializing`: we haven't done anything yet
   */
  type: 'initializing';

  /** the first ref to the journal entry to try */
  journalEntryRef: { uid: string; jwt: string };

  /** the user for the authorization header */
  user: {
    /** the login context */
    loginContext: LoginContextValue;

    /** The visitor who is signed in */
    visitor: Visitor;
  };
};

/**
 * Transitions:
 * - `preparing-client-key`: once we are ready to get the client key
 * - `error`: if we fail to get the user
 * - `released`: if released before we get the user
 *
 * Previous states:
 * - `initializing`
 */
export type StatePreparingReferences = {
  /**
   * - `preparing-references`: we are acquiring the required information to
   *   sync with the websocket endpoint
   */
  type: 'preparing-references';

  /** the first ref to the journal entry to try */
  journalEntryRef: { uid: string; jwt: string };

  /** the user for the authorization header */
  user: {
    /** the login context */
    loginContext: LoginContextValue;

    /** The visitor who is signed in */
    visitor: Visitor;

    /** a promise that resolves to the acceptable user tokens or rejects */
    promise: CancelablePromise<LoginContextValueLoggedIn>;
  };
};

/**
 * Transitions:
 * - `authorizing`: once we have a client key ready to sync with
 * - `error`: if we fail to get the journal client key or journal entry ref
 * - `released`: if released before we get the user and journal client key
 *
 * Previous states:
 * - `preparing-references`
 */
export type StatePreparingClientKey = {
  /**
   * - `preparing-client-key`: we are getting the journal client key to
   *   use for the sync request
   */
  type: 'preparing-client-key';

  /** the journal entry ref to try */
  journalEntryRef: { uid: string; jwt: string };

  /** the user for the authorization header */
  user: {
    /** the login context */
    loginContext: LoginContextValue;

    /** The visitor who is signed in */
    visitor: Visitor;

    /** the tokens we are going to use */
    current: LoginContextValueLoggedIn;
  };

  /** the client key to use for encryption */
  clientKey: {
    /** a promise which resolves with the key */
    promise: Promise<WrappedJournalClientKey>;
  };
};

/**
 * Transitions:
 * - `streaming`: once we are ready to open the websocket
 * - `error`: if the sync request fails
 * - `released`: if released before the sync request finishes
 *
 * Previous states:
 * - `preparing-client-key`
 */
export type StateAuthorizing = {
  /**
   * - `authorizing`: we are requesting authorization to the websocket endpoint
   */
  type: 'authorizing';

  /** the journal entry ref to try */
  journalEntryRef: { uid: string; jwt: string };

  /** the user for the authorization header */
  user: {
    /** the login context */
    loginContext: LoginContextValue;

    /** The visitor who is signed in */
    visitor: Visitor;

    /** the tokens we are going to use */
    current: LoginContextValueLoggedIn;
  };

  /** the journal client key to use for the sync request */
  clientKey: {
    /** the journal client key we are using right now */
    current: WrappedJournalClientKey;
  };

  /** progress on calling the sync http endpoint */
  progress: SmartAPIFetch<{
    journal_chat_jwt: string;
    journal_entry_uid: string;
    journal_entry_jwt: string;
  }>;
};

/**
 * Transitions:
 * - `ready`: once the chat state is synced up and we are ready to submit messages
 * - `error`: if one occurs while syncing the chat state
 * - `released`: if a release message is received before the chat state is synced
 *
 * Previous states:
 * - `authorizing`
 * - `catching-up` (when we detect a discrepancy between the anticipated and actual state)
 */
export type StateStreaming = {
  /**
   * - `streaming`: we are downloading the chat from the websocket; the server
   *   may be actively generating the response, so this can go significantly
   *   slower than the file size would suggest
   */
  type: 'streaming';

  /** the journal entry ref we are trying */
  journalEntryRef: { uid: string; jwt: string };

  /** the chat authorization jwt we are trying */
  chatAuth: { current: { jwt: string } };

  /** the user for the authorization header */
  user: {
    /** the login context */
    loginContext: LoginContextValue;

    /** The visitor who is signed in */
    visitor: Visitor;

    /** the tokens we are going to use */
    current: LoginContextValueLoggedIn;
  };

  /** the journal client key to use for the sync request */
  clientKey: {
    /** the journal client key we are using right now */
    current: WrappedJournalClientKey;
  };

  /** the websocket we are using */
  websocket: SmartWebsocketConnect<{
    success: true;
    type: 'auth_response';
    uid: string;
    data: unknown;
  }>;

  /** the value that is currently being received */
  value: {
    /** the displayable journal chat state */
    displayable: WritableValueWithCallbacks<JournalChatState>;
  };
};

/**
 * Transitions:
 * - `preparing-refresh`: if we receive a request to refresh the chat state,
 *   typically with a mutation (e.g., submitting a response or editing our response)
 * - `released`: if a release message is received
 *
 * Previous states:
 * - `streaming`
 * - `catching-up`
 *
 * Messages:
 * - `hard-refresh`: go back to `initializing`; technically this message is
 *   redundant as you could just create a new state machine, but it's provided as
 *   a robust implementation and to show the difference compared to incremental refresh
 * - `incremental-refresh`: go to `incremental-refresh`
 * - `release`: go to `released`
 */
export type StateReady = {
  /**
   * - `ready`: we have the journal chat state and don't have an active connection
   */
  type: 'ready';

  /** the latest journal entry ref */
  journalEntryRef: { uid: string; jwt: string };

  /** the user for the authorization header */
  user: {
    /** the login context */
    loginContext: LoginContextValue;

    /** The visitor who is signed in */
    visitor: Visitor;
  };

  /** the value that we received */
  value: {
    /** the displayable journal chat state */
    displayable: WritableValueWithCallbacks<JournalChatState>;
  };
};

/**
 * Transitions:
 * - `incremental-refresh-preparing-references`: asap
 * - `released`: if a release message is received
 *
 * Previous states:
 * - `ready` (via `incremental-refresh` message)
 */
export type StateIncrementalRefresh = {
  /**
   * - `incremental-refresh`: state right after the `incremental-refresh`
   *   message is processed to bring the info into the state machine
   */
  type: 'incremental-refresh';

  /** the journal ref to use; may have been updated by the message */
  journalEntryRef: { uid: string; jwt: string };

  /** the user for the authorization header */
  user: {
    /** the login context */
    loginContext: LoginContextValue;

    /** The visitor who is signed in */
    visitor: Visitor;
  };

  /** the chat authorization jwt to try */
  chatAuth: {
    /**
     * The function that will handle setting up the api fetch to get the
     * new chat jwt
     */
    get: (
      user: LoginContextValueLoggedIn,
      visitor: Visitor,
      clientKey: WrappedJournalClientKey,
      journalEntryRef: { uid: string; jwt: string }
    ) => Promise<
      SmartAPIFetchOptions<{
        journal_chat_jwt: string;
        journal_entry_uid: string;
        journal_entry_jwt: string;
      }>
    >;
  };

  /** the value to use */
  value: {
    /** the last chat state we actually received from the server */
    confirmed: JournalChatState;

    /** the anticipated journal chat state we will have after the refresh */
    anticipated: JournalChatState;

    /**
     * the displayable journal chat state; at this step this is always
     * anticipated
     */
    displayable: WritableValueWithCallbacks<JournalChatState>;
  };
};

/**
 * Transitions:
 * - `incremental-refresh-preparing-client-key`: once the user is ready
 * - `error`: if we fail to get the user
 * - `released`: if released before we get the user
 *
 * Previous states:
 * - `incremental-refresh`
 */
export type StateIncrementalRefreshPreparingReferences = {
  /**
   * - `incremental-refresh-preparing-references`: like `preparing-references`,
   *   except we know a confirmed journal chat state and we are displaying an
   *   anticipated journal chat state
   */
  type: 'incremental-refresh-preparing-references';

  /** the journal ref to use; may have been updated by the message */
  journalEntryRef: { uid: string; jwt: string };

  /** the user for the authorization header */
  user: {
    /** the login context */
    loginContext: LoginContextValue;

    /** The visitor who is signed in */
    visitor: Visitor;

    /** a promise that resolves to the acceptable user tokens or rejects */
    promise: CancelablePromise<LoginContextValueLoggedIn>;
  };

  /** the chat authorization jwt to try */
  chatAuth: {
    /**
     * The function that will handle setting up the api fetch to get the
     * new chat jwt
     */
    get: (
      user: LoginContextValueLoggedIn,
      visitor: Visitor,
      clientKey: WrappedJournalClientKey,
      journalEntryRef: { uid: string; jwt: string }
    ) => Promise<
      SmartAPIFetchOptions<{
        journal_chat_jwt: string;
        journal_entry_uid: string;
        journal_entry_jwt: string;
      }>
    >;
  };

  /** the value to use */
  value: {
    /** the last chat state we actually received from the server */
    confirmed: JournalChatState;

    /** the anticipated journal chat state we will have after the refresh */
    anticipated: JournalChatState;

    /**
     * the displayable journal chat state; at this step this is always
     * anticipated
     */
    displayable: WritableValueWithCallbacks<JournalChatState>;
  };
};

/**
 * Transitions:
 * - `incremental-refresh-authorizing`: once we are ready to get the chat authorization
 * - `error`: if we fail to get the chat authorization
 * - `released`: if released before we get the chat authorization
 *
 * Previous states:
 * - `incremental-refresh-preparing-references`
 */
export type StateIncrementalRefreshPreparingClientKey = {
  /**
   * - `incremental-refresh-preparing-client-key`: like `preparing-client-key`,
   *   except we know a confirmed journal chat state and we are displaying an
   *   anticipated journal chat state
   */
  type: 'incremental-refresh-preparing-client-key';

  /** the journal ref to use to get the chat auth; may have been updated by the message */
  journalEntryRef: { uid: string; jwt: string };

  /** the user for the authorization header */
  user: {
    /** the login context */
    loginContext: LoginContextValue;

    /** The visitor who is signed in */
    visitor: Visitor;

    /** the user authorization tokens we will use */
    current: LoginContextValueLoggedIn;
  };

  /** the chat authorization jwt to try */
  chatAuth: {
    /**
     * The function that will handle setting up the api fetch to get the
     * new chat jwt
     */
    get: (
      user: LoginContextValueLoggedIn,
      visitor: Visitor,
      clientKey: WrappedJournalClientKey,
      journalEntryRef: { uid: string; jwt: string }
    ) => Promise<
      SmartAPIFetchOptions<{
        journal_chat_jwt: string;
        journal_entry_uid: string;
        journal_entry_jwt: string;
      }>
    >;
  };

  /** the value to use */
  value: {
    /** the last chat state we actually received from the server */
    confirmed: JournalChatState;

    /** the anticipated journal chat state we will have after the refresh */
    anticipated: JournalChatState;

    /**
     * the displayable journal chat state; at this step this is always
     * anticipated
     */
    displayable: WritableValueWithCallbacks<JournalChatState>;
  };

  /** the client key to use for encryption */
  clientKey: {
    /** a promise which resolves with the wrapped key */
    promise: Promise<WrappedJournalClientKey>;
  };
};

/**
 * Transitions:
 * - `catching-up`: once we are ready to stream the new state
 * - `error`: if we fail to get the chat authorization
 * - `released`: if released before we get the chat authorization
 *
 * Previous states:
 * - `incremental-refresh-preparing-client-key`
 */
export type StateIncrementalRefreshAuthorizing = {
  /**
   * - `incremental-refresh-authorizing`: like `authorizing`, except we know a
   *   confirmed journal chat state and we are displaying an anticipated journal
   *   chat state
   */
  type: 'incremental-refresh-authorizing';

  /** the journal ref to use; may have been updated by the message */
  journalEntryRef: { uid: string; jwt: string };

  /** the user for the authorization header */
  user: {
    /** the login context */
    loginContext: LoginContextValue;

    /** The visitor who is signed in */
    visitor: Visitor;

    /** the user authorization tokens we will use */
    current: LoginContextValueLoggedIn;
  };

  /** the value to use */
  value: {
    /** the last chat state we actually received from the server */
    confirmed: JournalChatState;

    /** the anticipated journal chat state we will have after the refresh */
    anticipated: JournalChatState;

    /**
     * the displayable journal chat state; at this step this is always
     * anticipated
     */
    displayable: WritableValueWithCallbacks<JournalChatState>;
  };

  /** the client key to use for encryption */
  clientKey: {
    /** the wrapped key we are using */
    current: WrappedJournalClientKey;
  };

  /** the ongoing request to get authorization to stream the new state */
  progress: SmartAPIFetch<{
    journal_chat_jwt: string;
    journal_entry_uid: string;
    journal_entry_jwt: string;
  }>;
};

/**
 * Transitions:
 * - `streaming`: if we detect that the chat state isn't going to match what
 *   we are anticipating
 * - `ready`: if the chat state is confirmed to match the anticipated state
 * - `error`: if we fail to get the chat state
 * - `released`: if released before we get the chat state
 *
 * Previous states:
 * - `incremental-refresh-authorizing`
 */
export type StateCatchingUp = {
  /**
   * - `catching-up`: like streaming, but we have an anticipated final state
   *   and we haven't seen any reason to believe it's wrong, so we're displaying
   *   the anticipated state
   */
  type: 'catching-up';

  /** the journal ref we are using */
  journalEntryRef: { uid: string; jwt: string };

  /** the user for the authorization header */
  user: {
    /** the login context */
    loginContext: LoginContextValue;

    /** The visitor who is signed in */
    visitor: Visitor;

    /** the user authorization tokens we are using */
    current: LoginContextValueLoggedIn;
  };

  /** the chat authorization jwt we are trying */
  chatAuth: { current: { jwt: string } };

  /** the client key to use for encryption */
  clientKey: {
    /** the wrapped key we are using */
    current: WrappedJournalClientKey;
  };

  /** the websocket we are using */
  websocket: SmartWebsocketConnect<{
    success: true;
    type: 'auth_response';
    uid: string;
    data: unknown;
  }>;

  /** the value to use */
  value: {
    /** the last chat state we actually received from the server */
    old: JournalChatState;

    /** the anticipated journal chat state we will have after the refresh */
    anticipated: JournalChatState;

    /** the journal chat state we have gotten from the websocket so far */
    received: WritableValueWithCallbacks<JournalChatState>;

    /**
     * the displayable journal chat state; at this step this is always
     * anticipated
     */
    displayable: WritableValueWithCallbacks<JournalChatState>;
  };
};

/**
 * Previous states:
 * - almost any
 *
 * Transitions:
 * - `released`: once a release message is received
 */
export type StateError = {
  /**
   * - `error`: something prevented us from syncing the journal entry state.
   *   for transient issues, this means we exhausted all automatic retries
   */
  type: 'error';

  /** a description of the error that occurred */
  error: DisplayableError;
};

/**
 * Previous states:
 * - almost any
 *
 * Transitions:
 * - none, this is the final state
 */
export type StateReleased = {
  /**
   * - `released`: this reference is released; new messages will not
   *   be processed
   */
  type: 'released';
};

export type State =
  | StateInitializing
  | StatePreparingReferences
  | StatePreparingClientKey
  | StateAuthorizing
  | StateStreaming
  | StateReady
  | StateIncrementalRefresh
  | StateIncrementalRefreshPreparingReferences
  | StateIncrementalRefreshPreparingClientKey
  | StateIncrementalRefreshAuthorizing
  | StateCatchingUp
  | StateError
  | StateReleased;

/** `hard-refresh` */
export type MessageHardRefresh = {
  /**
   * - `hard-refresh`: can be sent in the `ready` state to return to
   *   initializing when keeping the same state machine is preferred to a
   *   release and recreate flow.
   */
  type: 'hard-refresh';

  /**
   * if specified, replaces the journal entry ref; note that changing
   * the uid for a state machine managed by a request handler requires
   * very careful consideration and is generally better handled by
   * release and recreate
   */
  journalEntryRef?: { uid: string; jwt: string };
};

/**
 * `incremental-refresh`
 *
 * Generally, this should be constructed via a dedicated function as it can be
 * somewhat delicate.
 */
export type MessageIncrementalRefresh = {
  /**
   * - `incremental-refresh`: can be sent in the `ready` state to perform
   *   an api call that returns an a new journal entry ref and chat jwt
   *   which can then be streamed to get a journal chat state that can be
   *   at least partially predicted. The prototypical example is the user
   *   adds a response to the chat; we can predict that the new state is
   *   the current state + the users response, and when the system response
   *   is detected we can switch to just streaming the new state without
   *   any UI flicker.
   */
  type: 'incremental-refresh';

  /**
   * Once we have prepared everything that will be needed to form the api
   * request, this returns the options for the api fetch call.
   */
  get: (
    user: LoginContextValueLoggedIn,
    visitor: Visitor,
    clientKey: WrappedJournalClientKey,
    journalEntryRef: { uid: string; jwt: string }
  ) => Promise<
    SmartAPIFetchOptions<{
      journal_chat_jwt: string;
      journal_entry_uid: string;
      journal_entry_jwt: string;
    }>
  >;

  /**
   * The journal chat state we are anticipating. As we stream from
   * the server we will display this state until we know it's incorrect,
   * which will avoid showing empty, then filling in this state, then
   * the new stuff (which looks weird)
   */
  anticipated: JournalChatState;
};

/** `release` */
export type MessageRelease = {
  /**
   * - `release`: transitions the state machine to the released state and
   *   prevents future messages from being sent
   */
  type: 'release';
};

export type Message = MessageHardRefresh | MessageIncrementalRefresh | MessageRelease;

export type JournalEntryStateMachine = {
  /** the current state that can be inspected but not modified */
  state: ValueWithCallbacks<State>;

  /**
   * sends a message to the state machine and returns a promise for when
   * its been received.
   *
   * sending a message once the state machine is released raises an error
   *
   * sending a message while one is already being sent will queue the message,
   * but the message queue may not respect order and cannot be inspected, and
   * is not recommended
   */
  sendMessage: (msg: Message) => CancelablePromise<void>;
};

const ACTION = 'receive journal entry';

const manageLoop = async (
  stateVWC: WritableValueWithCallbacks<State>,
  messageVWC: WritableValueWithCallbacks<Message | null>
) => {
  try {
    while (true) {
      const previous = stateVWC.get();
      console.log('JEstate machine in ', previous.type);
      switch (previous.type) {
        case 'initializing':
          await transitionFromInitializing(stateVWC, messageVWC);
          break;
        case 'preparing-references':
          await transitionFromPreparingReferences(stateVWC, messageVWC);
          break;
        case 'preparing-client-key':
          await transitionFromPreparingClientKey(stateVWC, messageVWC);
          break;
        case 'authorizing':
          await transitionFromAuthorizing(stateVWC, messageVWC);
          break;
        case 'streaming':
          await transitionFromStreaming(stateVWC, messageVWC);
          break;
        case 'ready':
          await transitionFromReady(stateVWC, messageVWC);
          break;
        case 'incremental-refresh':
          await transitionFromIncrementalRefresh(stateVWC, messageVWC);
          break;
        case 'incremental-refresh-preparing-references':
          await transitionFromIncrementalRefreshPreparingReferences(stateVWC, messageVWC);
          break;
        case 'incremental-refresh-preparing-client-key':
          await transitionFromIncrementalRefreshPreparingClientKey(stateVWC, messageVWC);
          break;
        case 'incremental-refresh-authorizing':
          await transitionFromIncrementalRefreshAuthorizing(stateVWC, messageVWC);
          break;
        case 'catching-up':
          await transitionFromCatchingUp(stateVWC, messageVWC);
          break;
        case 'error':
          await transitionFromError(stateVWC, messageVWC);
          break;
        case 'released':
          clearMessagesWithVWC(messageVWC);
          return;
        default:
          throw new Error(`bad state: ${JSON.stringify(previous)}`);
      }
      const now = stateVWC.get();
      if (previous.type === now.type) {
        setVWC(stateVWC, { type: 'released' });
        clearMessagesWithVWC(messageVWC);
        throw new Error(`state machine did not transition: ${previous.type}`);
      }
    }
  } catch (e) {
    console.log('createJournalEntryStateMachine error in manageLoop: ', e);
    if (stateVWC.get().type !== 'released') {
      setVWC(stateVWC, { type: 'released' });
    }
    clearMessagesWithVWC(messageVWC);
  }
};

const transitionFromInitializing = async (
  stateVWC: WritableValueWithCallbacks<State>,
  messageVWC: WritableValueWithCallbacks<Message | null>
) => {
  const current = stateVWC.get();
  if (current.type !== 'initializing') {
    throw new Error(current.type);
  }

  if (messageVWC.get() !== null) {
    setVWC(stateVWC, { type: 'released' });

    const msg = messageVWC.get();
    messageVWC.set(null);
    messageVWC.callbacks.call(undefined);

    if (msg !== null && msg.type === 'release') {
      return;
    }

    await clearMessagesWithVWC(messageVWC);
    throw new Error(`unexpected msg in ${current.type}: ${JSON.stringify(msg)}`);
  }

  setVWC(stateVWC, {
    type: 'preparing-references',
    journalEntryRef: current.journalEntryRef,
    user: {
      loginContext: current.user.loginContext,
      visitor: current.user.visitor,
      promise: getLoggedInUserCancelable(current.user.loginContext),
    },
  });
};

const transitionFromPreparingReferences = async (
  stateVWC: WritableValueWithCallbacks<State>,
  messageVWC: WritableValueWithCallbacks<Message | null>
) => {
  const current = stateVWC.get();
  if (current.type !== 'preparing-references') {
    throw new Error(current.type);
  }

  const messageCancelable = receiveMessageWithVWC(messageVWC);
  messageCancelable.promise.catch(() => {});
  await Promise.race([messageCancelable.promise, current.user.promise.promise]);
  if (messageCancelable.done()) {
    current.user.promise.promise.catch(() => {});
    current.user.promise.cancel();

    setVWC(stateVWC, { type: 'released' });
    const msg = (await messageCancelable.promise)();
    if (msg.type !== 'release') {
      throw new Error(`unexpected msg in ${current.type}: ${JSON.stringify(msg)}`);
    }
    return;
  }
  messageCancelable.cancel();
  let user;
  try {
    user = await current.user.promise.promise;
  } catch (e) {
    setVWC(stateVWC, {
      type: 'error',
      error: e instanceof DisplayableError ? e : new DisplayableError('client', ACTION, `${e}`),
    });
    return;
  }
  setVWC(stateVWC, {
    type: 'preparing-client-key',
    journalEntryRef: current.journalEntryRef,
    user: {
      loginContext: current.user.loginContext,
      visitor: current.user.visitor,
      current: user,
    },
    clientKey: {
      promise: getOrCreateWrappedClientKey(user, current.user.visitor),
    },
  });
};

const transitionFromPreparingClientKey = async (
  stateVWC: WritableValueWithCallbacks<State>,
  messageVWC: WritableValueWithCallbacks<Message | null>
) => {
  const current = stateVWC.get();
  if (current.type !== 'preparing-client-key') {
    throw new Error(current.type);
  }

  const messageCancelable = receiveMessageWithVWC(messageVWC);
  messageCancelable.promise.catch(() => {});
  await Promise.race([messageCancelable.promise, current.clientKey.promise]);
  if (messageCancelable.done()) {
    current.clientKey.promise.catch(() => {});

    setVWC(stateVWC, { type: 'released' });
    const msg = (await messageCancelable.promise)();
    if (msg.type !== 'release') {
      throw new Error(`unexpected msg in ${current.type}: ${JSON.stringify(msg)}`);
    }
    return;
  }

  messageCancelable.cancel();
  let clientKey;
  try {
    clientKey = await current.clientKey.promise;
  } catch (e) {
    setVWC(stateVWC, {
      type: 'error',
      error: e instanceof DisplayableError ? e : new DisplayableError('client', ACTION, `${e}`),
    });
    return;
  }

  setVWC(stateVWC, {
    type: 'authorizing',
    journalEntryRef: current.journalEntryRef,
    user: current.user,
    clientKey: {
      current: clientKey,
    },
    progress: createSmartAPIFetch({
      path: '/api/1/journals/entries/sync',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          platform: VISITOR_SOURCE,
          journal_client_key_uid: clientKey.uid,
          journal_entry_uid: current.journalEntryRef.uid,
          journal_entry_jwt: current.journalEntryRef.jwt,
        }),
      },
      mapper: createTypicalSmartAPIFetchMapper({
        mapJSON: (v) => v,
        action: ACTION,
        bonusRetryableStatusCodes: [404],
      }),
      retryer: 'default',
      user: () => ({ user: current.user.current }),
    }),
  });
};

const createSmartWebsocketConnectForJournalChat = (
  chatJwt: string
): SmartWebsocketConnect<{
  success: true;
  type: 'auth_response';
  uid: string;
  data: unknown;
}> => {
  return createSmartWebsocketConnect({
    path: '/api/2/journals/chat',
    greeter: (incoming, outgoing) =>
      constructCancelablePromise({
        body: async (state, resolve, reject) => {
          const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
          canceled.promise.catch(() => {});
          if (state.finishing) {
            canceled.cancel();
            state.done = true;
            reject(new DisplayableError('canceled', 'greet websocket', 'in initialize'));
            return;
          }

          const sentOutgoing = passMessageWithVWC(
            outgoing,
            JSON.stringify({
              type: 'authorize',
              data: {
                jwt: chatJwt,
              },
            })
          );
          await Promise.race([canceled.promise, sentOutgoing.promise]);
          if (state.finishing) {
            canceled.cancel();
            sentOutgoing.cancel();
            state.done = true;
            reject(new DisplayableError('canceled', 'greet websocket', 'waiting for send'));
            return;
          }

          const receivedIncoming = waitForValueWithCallbacksConditionCancelable(
            incoming,
            (v) => v.length > 0
          );
          await Promise.race([canceled.promise, receivedIncoming.promise]);
          if (state.finishing) {
            canceled.cancel();
            receivedIncoming.cancel();
            state.done = true;
            reject(new DisplayableError('canceled', 'greet websocket', 'waiting for receive'));
            return;
          }
          const msg = incoming.get().shift();
          incoming.callbacks.call(undefined);
          if (msg === undefined) {
            canceled.cancel();
            state.finishing = true;
            state.done = true;
            reject(
              new DisplayableError('client', 'greet websocket', 'msg undefined despite waiting')
            );
            return;
          }

          let parsed;
          let msgAsString;
          try {
            msgAsString = typeof msg === 'string' ? msg : new TextDecoder().decode(msg);
            parsed = JSON.parse(msgAsString) as any;
          } catch (e) {
            canceled.cancel();
            state.finishing = true;
            state.done = true;
            reject(
              new DisplayableError('client', 'greet websocket', `parse incoming packet: ${e}`)
            );
            return;
          }

          if (typeof parsed !== 'object' || parsed === null) {
            canceled.cancel();
            state.finishing = true;
            state.done = true;
            reject(
              new DisplayableError(
                'client',
                'greet websocket',
                `unexpected incoming packet (not object): ${msgAsString}`
              )
            );
            return;
          }

          if (!('success' in parsed)) {
            canceled.cancel();
            state.finishing = true;
            state.done = true;
            reject(
              new DisplayableError(
                'client',
                'greet websocket',
                `unexpected incoming packet (no success): ${msgAsString}`
              )
            );
            return;
          }

          if (parsed.success !== true) {
            canceled.cancel();
            state.finishing = true;
            state.done = true;
            reject(
              new DisplayableError(
                'client',
                'greet websocket',
                `unexpected incoming packet (not success): ${msgAsString}`
              )
            );
            return;
          }

          if (!('type' in parsed)) {
            canceled.cancel();
            state.finishing = true;
            state.done = true;
            reject(
              new DisplayableError(
                'client',
                'greet websocket',
                `unexpected incoming packet (no type): ${msgAsString}`
              )
            );
            return;
          }

          if (parsed.type !== 'auth_response') {
            canceled.cancel();
            state.finishing = true;
            state.done = true;
            reject(
              new DisplayableError(
                'client',
                'greet websocket',
                `unexpected incoming packet (not auth_response): ${msgAsString}`
              )
            );
            return;
          }

          if (!('uid' in parsed)) {
            canceled.cancel();
            state.finishing = true;
            state.done = true;
            reject(
              new DisplayableError(
                'client',
                'greet websocket',
                `unexpected incoming packet (no uid): ${msgAsString}`
              )
            );
            return;
          }

          if (typeof parsed.uid !== 'string') {
            canceled.cancel();
            state.finishing = true;
            state.done = true;
            reject(
              new DisplayableError(
                'client',
                'greet websocket',
                `unexpected incoming packet (uid not string): ${msgAsString}`
              )
            );
            return;
          }

          if (!('data' in parsed)) {
            canceled.cancel();
            state.finishing = true;
            state.done = true;
            reject(
              new DisplayableError(
                'client',
                'greet websocket',
                `unexpected incoming packet (no data): ${msgAsString}`
              )
            );
            return;
          }

          if (typeof parsed.data !== 'object' || parsed.data === null) {
            canceled.cancel();
            state.finishing = true;
            state.done = true;
            reject(
              new DisplayableError(
                'client',
                'greet websocket',
                `unexpected incoming packet (data not object): ${msgAsString}`
              )
            );
            return;
          }

          state.finishing = true;
          state.done = true;
          resolve(parsed);
        },
      }),
    retryer: 'default',
  });
};

const transitionFromAuthorizing = async (
  stateVWC: WritableValueWithCallbacks<State>,
  messageVWC: WritableValueWithCallbacks<Message | null>
) => {
  const current = stateVWC.get();
  if (current.type !== 'authorizing') {
    throw new Error(current.type);
  }

  const messageCancelable = receiveMessageWithVWC(messageVWC);
  messageCancelable.promise.catch(() => {});
  const authorizedCancelable = waitForValueWithCallbacksConditionCancelable(
    current.progress.state,
    (s) => s.type !== 'in-flight' && s.type !== 'waiting'
  );
  authorizedCancelable.promise.catch(() => {});
  await Promise.race([messageCancelable.promise, authorizedCancelable.promise]);
  if (messageCancelable.done()) {
    authorizedCancelable.cancel();
    if (current.progress.state.get().type !== 'released') {
      current.progress.sendMessage({ type: 'release' });
    }

    setVWC(stateVWC, { type: 'released' });
    const msg = (await messageCancelable.promise)();
    if (msg.type !== 'release') {
      throw new Error(`unexpected msg in ${current.type}: ${JSON.stringify(msg)}`);
    }
    return;
  }
  messageCancelable.cancel();
  authorizedCancelable.cancel();

  const authorizeResult = current.progress.state.get();
  console.log('authorizeResult:', authorizeResult);
  if (authorizeResult.type !== 'released') {
    current.progress.sendMessage({ type: 'release' });
  }

  if (authorizeResult.type !== 'success') {
    setVWC(stateVWC, {
      type: 'error',
      error:
        authorizeResult.type === 'error'
          ? authorizeResult.error
          : new DisplayableError('client', ACTION, `authorize state: ${authorizeResult.type}`),
    });
    return;
  }

  const chatState: JournalChatState = {
    uid: authorizeResult.value.journal_entry_uid,
    integrity: '',
    data: [],
    transient: null,
  };
  chatState.integrity = await computeJournalChatStateDataIntegrity(chatState);

  setVWC(stateVWC, {
    type: 'streaming',
    journalEntryRef: {
      uid: authorizeResult.value.journal_entry_uid,
      jwt: authorizeResult.value.journal_entry_jwt,
    },
    chatAuth: {
      current: {
        jwt: authorizeResult.value.journal_chat_jwt,
      },
    },
    user: current.user,
    clientKey: current.clientKey,
    websocket: createSmartWebsocketConnectForJournalChat(authorizeResult.value.journal_chat_jwt),
    value: {
      displayable: createWritableValueWithCallbacks<JournalChatState>(chatState),
    },
  });
};

const applyIncomingThinkingBarMessage = (
  toMutate: JournalChatState,
  msgAsString: string,
  data: { type: 'thinking-bar'; at: number; of: number; message: string; detail?: string | null }
): { more: boolean } => {
  if (!('at' in data)) {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet thinking-bar data (no at): ${msgAsString}`
    );
  }

  if (typeof data.at !== 'number') {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet thinking-bar data (at not number): ${msgAsString}`
    );
  }

  if (!('of' in data)) {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet thinking-bar data (no of): ${msgAsString}`
    );
  }

  if (typeof data.of !== 'number') {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet thinking-bar data (of not number): ${msgAsString}`
    );
  }

  if (!('message' in data)) {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet thinking-bar data (no message): ${msgAsString}`
    );
  }

  if (typeof data.message !== 'string') {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet thinking-bar data (message not string): ${msgAsString}`
    );
  }

  if ('detail' in data) {
    if (data.detail !== undefined && data.detail !== null && typeof data.detail !== 'string') {
      throw new DisplayableError(
        'client',
        ACTION,
        `unexpected incoming packet thinking-bar data (detail not string): ${msgAsString}`
      );
    }
  }

  toMutate.transient = {
    type: 'thinking-bar',
    at: data.at,
    of: data.of,
    message: data.message,
    detail: data.detail ?? null,
  };

  return { more: true };
};

const applyIncomingThinkingSpinnerMessage = (
  toMutate: JournalChatState,
  msgAsString: string,
  data: { type: 'thinking-spinner'; message: string; detail?: string | null }
): { more: boolean } => {
  if (!('message' in data)) {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet thinking-spinner data (no message): ${msgAsString}`
    );
  }

  if (typeof data.message !== 'string') {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet thinking-spinner data (message not string): ${msgAsString}`
    );
  }

  if ('detail' in data) {
    if (data.detail !== undefined && data.detail !== null && typeof data.detail !== 'string') {
      throw new DisplayableError(
        'client',
        ACTION,
        `unexpected incoming packet thinking-spinner data (detail not string): ${msgAsString}`
      );
    }
  }

  toMutate.transient = {
    type: 'thinking-spinner',
    message: data.message,
    detail: data.detail ?? null,
  };

  return { more: true };
};

const applyIncomingError = (
  toMutate: JournalChatState,
  msgAsString: string,
  data: { type: 'error'; code: number; message: string; detail?: string }
): { more: boolean } => {
  if (!('code' in data)) {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet error data (no code): ${msgAsString}`
    );
  }

  if (typeof data.code !== 'number') {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet error data (code not number): ${msgAsString}`
    );
  }

  if (!('message' in data)) {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet error data (no message): ${msgAsString}`
    );
  }

  if (typeof data.message !== 'string') {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet error data (message not string): ${msgAsString}`
    );
  }

  if ('detail' in data) {
    if (data.detail !== undefined && data.detail !== null && typeof data.detail !== 'string') {
      throw new DisplayableError(
        'client',
        ACTION,
        `unexpected incoming packet error data (detail not string): ${msgAsString}`
      );
    }
  }

  const detail = data.detail ?? null;
  throw new DisplayableError(
    'server-retryable',
    ACTION,
    `${data.code}: ${data.message} (${detail})`
  );
};

const applyIncomingChat = async (
  toMutate: JournalChatState,
  msgAsString: string,
  data: { type: 'chat'; encrypted_segment_data: string; more?: boolean },
  clientKey: WrappedJournalClientKey
): Promise<{ more: boolean }> => {
  if (!('encrypted_segment_data' in data)) {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet chat data (no encrypted_segment_data): ${msgAsString}`
    );
  }

  if (typeof data.encrypted_segment_data !== 'string') {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet chat data (encrypted_segment_data not string): ${msgAsString}`
    );
  }

  const more = 'more' in data && data.more === true;

  let segmentDataString;
  try {
    const nowServer = await getCurrentServerTimeMS();
    segmentDataString = await clientKey.key.decrypt(data.encrypted_segment_data, nowServer);
  } catch (e) {
    throw new DisplayableError('client', ACTION, `decrypt chat segment: ${e}`);
  }

  let segmentData;
  try {
    segmentData = JSON.parse(segmentDataString) as any;
  } catch (e) {
    throw new DisplayableError('client', ACTION, `parse chat segment: ${e}`);
  }

  if (typeof segmentData !== 'object' || segmentData === null) {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet chat segment data (not object): ${segmentDataString}`
    );
  }

  if (!('mutations' in segmentData)) {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet chat segment data (no mutations): ${segmentDataString}`
    );
  }

  if (!Array.isArray(segmentData.mutations)) {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet chat segment data (mutations not array): ${segmentDataString}`
    );
  }

  const mutations = segmentData.mutations as any[];
  for (let i = 0; i < mutations.length; i++) {
    const mutation = mutations[i];
    if (typeof mutation !== 'object' || mutation === null) {
      throw new DisplayableError(
        'client',
        ACTION,
        `unexpected incoming packet chat segment data mutation (not object @ index ${i}): ${segmentDataString}`
      );
    }

    if (!('key' in mutation)) {
      throw new DisplayableError(
        'client',
        ACTION,
        `unexpected incoming packet chat segment data mutation (no key @ index ${i}): ${segmentDataString}`
      );
    }

    if (!Array.isArray(mutation.key)) {
      throw new DisplayableError(
        'client',
        ACTION,
        `unexpected incoming packet chat segment data mutation (key not array @ index ${i}): ${segmentDataString}`
      );
    }

    if (!('value' in mutation)) {
      throw new DisplayableError(
        'client',
        ACTION,
        `unexpected incoming packet chat segment data mutation (no value @ index ${i}): ${segmentDataString}`
      );
    }

    const key = mutation.key as (string | number)[];
    if (key.length === 0) {
      for (const [k, v] of Object.entries(mutation.value as JournalChatState)) {
        (toMutate as any)[k] = v;
      }
    } else {
      deepSet(toMutate, key, mutation.value);
    }
  }

  if (more) {
    toMutate.transient = {
      type: 'thinking-spinner',
      message: 'waiting to receive more data...',
      detail: null,
    };
  } else {
    toMutate.transient = null;
  }

  const expectedIntegrity = await computeJournalChatStateDataIntegrity(toMutate);
  if (toMutate.integrity !== expectedIntegrity) {
    throw new DisplayableError(
      'client',
      ACTION,
      `integrity mismatch: expected ${expectedIntegrity}, got ${toMutate.integrity}`
    );
  }

  return { more };
};

const applyIncomingMessage = async (
  toMutate: JournalChatState,
  msg: string | ArrayBuffer,
  clientKey: WrappedJournalClientKey
): Promise<{ more: boolean }> => {
  let msgAsString;
  let parsed;
  try {
    msgAsString = typeof msg === 'string' ? msg : new TextDecoder('utf-8').decode(msg);
    parsed = JSON.parse(msgAsString) as {
      success: true;
      type: 'event_batch';
      uid: string;
      data: {
        events: (
          | JournalChatTransientHint
          | { type: 'error'; code: number; message: string; detail?: string }
          | {
              type: 'chat';
              encrypted_segment_data: string;
              more?: boolean;
            }
        )[];
      };
    };
  } catch (e) {
    throw new DisplayableError('client', ACTION, `parse incoming packet: ${e}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet (not object): ${msgAsString}`
    );
  }

  if (!('uid' in parsed)) {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet (no uid): ${msgAsString}`
    );
  }

  if (typeof parsed.uid !== 'string') {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet (uid not string): ${msgAsString}`
    );
  }

  if (!('type' in parsed)) {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet (no type): ${msgAsString}`
    );
  }

  if (parsed.type !== 'event_batch') {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet (not event_batch): ${msgAsString}`
    );
  }

  if (!('data' in parsed)) {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet (no data): ${msgAsString}`
    );
  }

  if (typeof parsed.data !== 'object' || parsed.data === null) {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet (data not object): ${msgAsString}`
    );
  }

  if (!('events' in parsed.data)) {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet (no events in event batch): ${msgAsString}`
    );
  }

  if (!Array.isArray(parsed.data.events)) {
    throw new DisplayableError(
      'client',
      ACTION,
      `unexpected incoming packet (events not array): ${msgAsString}`
    );
  }

  let more = true;
  for (let i = 0; i < parsed.data.events.length; i++) {
    const eventData = parsed.data.events[i];
    if (typeof eventData !== 'object' || eventData === null) {
      throw new DisplayableError(
        'client',
        ACTION,
        `unexpected incoming packet (event not object @ index ${i}): ${msgAsString}`
      );
    }

    if (!('type' in eventData)) {
      throw new DisplayableError(
        'client',
        ACTION,
        `unexpected incoming packet (event no type @ index ${i}): ${msgAsString}`
      );
    }

    if (typeof eventData.type !== 'string') {
      throw new DisplayableError(
        'client',
        ACTION,
        `unexpected incoming packet (event type not string @ index ${i}): ${msgAsString}`
      );
    }

    let result;
    switch (eventData.type) {
      case 'thinking-bar':
        result = applyIncomingThinkingBarMessage(toMutate, msgAsString, eventData);
        break;
      case 'thinking-spinner':
        result = applyIncomingThinkingSpinnerMessage(toMutate, msgAsString, eventData);
        break;
      case 'error':
        result = applyIncomingError(toMutate, msgAsString, eventData);
        break;
      case 'chat':
        result = applyIncomingChat(toMutate, msgAsString, eventData, clientKey);
        break;
      default:
        throw new DisplayableError(
          'client',
          ACTION,
          `unexpected incoming packet (unknown event type @ index ${i}): ${msgAsString}`
        );
    }

    try {
      more = (await result).more && more;
    } catch (e) {
      if (e instanceof DisplayableError) {
        throw new DisplayableError(e.type, e.action, `${e.details} @ index ${i}`);
      }

      throw new DisplayableError('client', ACTION, `${e} @ index ${i}`);
    }
  }

  return { more };
};

const isAnticipatedStateStillPlausible = (
  anticipated: JournalChatState,
  received: JournalChatState
): boolean => {
  if (received.data.length > anticipated.data.length) {
    return false;
  }

  for (let i = 0; i < received.data.length; i++) {
    const recv = received.data[i];
    const ant = anticipated.data[i];
    if (recv.type !== ant.type) {
      return false;
    }

    if (recv.data.type !== ant.data.type) {
      return false;
    }

    if (recv.data.type === 'textual' && ant.data.type === 'textual') {
      if (recv.data.parts.length !== ant.data.parts.length) {
        return false;
      }

      for (let j = 0; j < recv.data.parts.length; j++) {
        const recvPart = recv.data.parts[j];
        const antPart = ant.data.parts[j];
        if (recvPart.type !== antPart.type) {
          return false;
        }

        if (
          recvPart.type === 'paragraph' &&
          antPart.type === 'paragraph' &&
          recvPart.value !== antPart.value
        ) {
          return false;
        }

        if (
          recvPart.type === 'journey' &&
          antPart.type === 'journey' &&
          recvPart.uid !== antPart.uid
        ) {
          return false;
        }

        if (
          recvPart.type === 'voice_note' &&
          antPart.type === 'voice_note' &&
          recvPart.voice_note_uid !== antPart.voice_note_uid
        ) {
          return false;
        }
      }
    }

    if (recv.data.type === 'summary' && ant.data.type === 'summary') {
      if (recv.data.title !== ant.data.title) {
        return false;
      }

      if (recv.data.tags.length !== ant.data.tags.length) {
        return false;
      }

      for (let j = 0; j < recv.data.tags.length; j++) {
        if (recv.data.tags[j] !== ant.data.tags[j]) {
          return false;
        }
      }
    }

    if (recv.data.type === 'ui' && ant.data.type === 'ui') {
      if (recv.data.conceptually.type !== ant.data.conceptually.type) {
        return false;
      }

      if (
        recv.data.conceptually.type === 'user_journey' &&
        ant.data.conceptually.type === 'user_journey' &&
        recv.data.conceptually.journey_uid !== ant.data.conceptually.journey_uid
      ) {
        return false;
      }
    }
  }

  return true;
};

const deepSet = (obj: any, path: (string | number)[], value: any) => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (path.length === 0) {
    return value;
  }

  const [head, ...tail] = path;
  if (tail.length === 0) {
    obj[head] = value;
    return obj;
  }

  if (obj[head] === undefined) {
    obj[head] = typeof tail[0] === 'number' ? [] : {};
  }

  deepSet(obj[head], tail, value);
  return obj;
};

export function deepClonePrimitives<T>(obj: T): T {
  if (window && window.structuredClone && typeof window.structuredClone === 'function') {
    return window.structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

const transitionFromStreaming = async (
  stateVWC: WritableValueWithCallbacks<State>,
  messageVWC: WritableValueWithCallbacks<Message | null>
) => {
  const current = stateVWC.get();
  if (current.type !== 'streaming') {
    throw new Error(current.type);
  }

  const messageCancelable = receiveMessageWithVWC(messageVWC);
  messageCancelable.promise.catch(() => {});
  const socketClosedCancelable = waitForValueWithCallbacksConditionCancelable(
    current.websocket.state,
    (s) => s.type === 'closed' || s.type === 'error' || s.type === 'released'
  );
  socketClosedCancelable.promise.catch(() => {});

  let sawFinalPacket = false;
  while (true) {
    if (messageCancelable.done()) {
      socketClosedCancelable.cancel();
      if (current.websocket.state.get().type !== 'released') {
        current.websocket.sendMessage({ type: 'release' });
      }
      setVWC(stateVWC, { type: 'released' });
      const msg = (await messageCancelable.promise)();
      if (msg.type !== 'release') {
        throw new Error(`unexpected msg in ${current.type}: ${JSON.stringify(msg)}`);
      }
      return;
    }

    const wsState = current.websocket.state.get();
    const incomingVWC =
      wsState.type === 'open' || wsState.type === 'closed' ? wsState.value.incoming : null;
    if (incomingVWC !== null) {
      const incoming = incomingVWC.get().shift();
      if (incoming !== undefined) {
        incomingVWC.callbacks.call(undefined);
        try {
          const { more } = await applyIncomingMessage(
            current.value.displayable.get(),
            incoming,
            current.clientKey.current
          );
          current.value.displayable.callbacks.call(undefined);
          if (!more) {
            sawFinalPacket = true;
            break;
          }
        } catch (e) {
          messageCancelable.cancel();
          socketClosedCancelable.cancel();
          if (current.websocket.state.get().type !== 'released') {
            current.websocket.sendMessage({ type: 'release' });
          }
          setVWC(stateVWC, {
            type: 'error',
            error:
              e instanceof DisplayableError ? e : new DisplayableError('client', ACTION, `${e}`),
          });
          return;
        }
        continue;
      }
    }

    if (socketClosedCancelable.done()) {
      break;
    }

    const haveIncomingMessage =
      incomingVWC !== null
        ? waitForValueWithCallbacksConditionCancelable(incomingVWC, (v) => v.length > 0)
        : waitForValueWithCallbacksConditionCancelable(
            current.websocket.state,
            (s) => s.type === 'open' || s.type === 'closed'
          );
    haveIncomingMessage.promise.catch(() => {});

    await Promise.race([
      messageCancelable.promise,
      socketClosedCancelable.promise,
      haveIncomingMessage.promise,
    ]);

    haveIncomingMessage.cancel();
  }

  // either we are in error, released, closed with no incoming, or open but we saw a final packet
  messageCancelable.cancel();
  socketClosedCancelable.cancel();

  const currentWSState = current.websocket.state.get();
  if (currentWSState.type !== 'released') {
    current.websocket.sendMessage({ type: 'release' });
  }

  if (!sawFinalPacket) {
    if (currentWSState.type === 'error') {
      setVWC(stateVWC, {
        type: 'error',
        error: currentWSState.error,
      });
      return;
    }

    setVWC(stateVWC, {
      type: 'error',
      error: new DisplayableError('client', ACTION, 'did not see final packet'),
    });
    return;
  }

  setVWC(stateVWC, {
    type: 'ready',
    journalEntryRef: current.journalEntryRef,
    user: current.user,
    value: current.value,
  });
};

const transitionFromReady = async (
  stateVWC: WritableValueWithCallbacks<State>,
  messageVWC: WritableValueWithCallbacks<Message | null>
) => {
  const current = stateVWC.get();
  if (current.type !== 'ready') {
    throw new Error(current.type);
  }

  const msg = (await receiveMessageWithVWC(messageVWC).promise)();
  if (msg.type === 'incremental-refresh') {
    const displayable = deepClonePrimitives(msg.anticipated);
    displayable.transient = {
      type: 'thinking-spinner',
      message: 'confirming with server',
      detail: null,
    };

    setVWC(stateVWC, {
      type: 'incremental-refresh',
      journalEntryRef: current.journalEntryRef,
      user: current.user,
      chatAuth: {
        get: msg.get,
      },
      value: {
        confirmed: current.value.displayable.get(),
        anticipated: msg.anticipated,
        displayable: createWritableValueWithCallbacks<JournalChatState>(displayable),
      },
    });
    return;
  }

  if (msg.type === 'hard-refresh') {
    const currentJwtExpiration = getJwtExpiration(current.journalEntryRef.jwt);
    const serverNow = await getCurrentServerTimeMS();
    if (currentJwtExpiration - 30_000 <= serverNow) {
      setVWC(stateVWC, {
        type: 'error',
        error: new DisplayableError(
          'server-refresh-required',
          ACTION,
          'hard refresh with expired jwt'
        ),
      });
      return;
    }

    setVWC(stateVWC, {
      type: 'initializing',
      journalEntryRef: current.journalEntryRef,
      user: current.user,
    });
    return;
  }

  setVWC(stateVWC, { type: 'released' });
  if (msg.type === 'release') {
    return;
  }

  throw new Error(`unexpected msg in ${current.type}: ${JSON.stringify(msg)}`);
};

const transitionFromIncrementalRefresh = async (
  stateVWC: WritableValueWithCallbacks<State>,
  messageVWC: WritableValueWithCallbacks<Message | null>
) => {
  const current = stateVWC.get();
  if (current.type !== 'incremental-refresh') {
    throw new Error(current.type);
  }

  setVWC(stateVWC, {
    type: 'incremental-refresh-preparing-references',
    journalEntryRef: current.journalEntryRef,
    user: {
      loginContext: current.user.loginContext,
      visitor: current.user.visitor,
      promise: getLoggedInUserCancelable(current.user.loginContext),
    },
    chatAuth: current.chatAuth,
    value: current.value,
  });
};

const transitionFromIncrementalRefreshPreparingReferences = async (
  stateVWC: WritableValueWithCallbacks<State>,
  messageVWC: WritableValueWithCallbacks<Message | null>
) => {
  const current = stateVWC.get();
  if (current.type !== 'incremental-refresh-preparing-references') {
    throw new Error(current.type);
  }

  const messageCancelable = receiveMessageWithVWC(messageVWC);
  messageCancelable.promise.catch(() => {});
  await Promise.race([messageCancelable.promise, current.user.promise.promise]);
  if (messageCancelable.done()) {
    current.user.promise.promise.catch(() => {});
    current.user.promise.cancel();

    setVWC(stateVWC, { type: 'released' });
    const msg = (await messageCancelable.promise)();
    if (msg.type !== 'release') {
      throw new Error(`unexpected msg in ${current.type}: ${JSON.stringify(msg)}`);
    }
    return;
  }
  messageCancelable.cancel();
  let user;
  try {
    user = await current.user.promise.promise;
  } catch (e) {
    setVWC(stateVWC, {
      type: 'error',
      error: e instanceof DisplayableError ? e : new DisplayableError('client', ACTION, `${e}`),
    });
    return;
  }
  setVWC(stateVWC, {
    type: 'incremental-refresh-preparing-client-key',
    journalEntryRef: current.journalEntryRef,
    user: {
      loginContext: current.user.loginContext,
      visitor: current.user.visitor,
      current: user,
    },
    chatAuth: current.chatAuth,
    clientKey: {
      promise: getOrCreateWrappedClientKey(user, current.user.visitor),
    },
    value: current.value,
  });
};

const transitionFromIncrementalRefreshPreparingClientKey = async (
  stateVWC: WritableValueWithCallbacks<State>,
  messageVWC: WritableValueWithCallbacks<Message | null>
) => {
  const current = stateVWC.get();
  if (current.type !== 'incremental-refresh-preparing-client-key') {
    throw new Error(current.type);
  }

  const messageCancelable = receiveMessageWithVWC(messageVWC);
  messageCancelable.promise.catch(() => {});
  await Promise.race([messageCancelable.promise, current.clientKey.promise]);
  if (messageCancelable.done()) {
    current.clientKey.promise.catch(() => {});

    setVWC(stateVWC, { type: 'released' });
    const msg = (await messageCancelable.promise)();
    if (msg.type !== 'release') {
      throw new Error(`unexpected msg in ${current.type}: ${JSON.stringify(msg)}`);
    }
    return;
  }

  messageCancelable.cancel();
  let clientKey;
  try {
    clientKey = await current.clientKey.promise;
  } catch (e) {
    setVWC(stateVWC, {
      type: 'error',
      error: e instanceof DisplayableError ? e : new DisplayableError('client', ACTION, `${e}`),
    });
    return;
  }

  // generally the only thing we're waiting on for this promise
  // is fernet encryption which is fast enough and not cancelable
  // so we're not interrupting on a message here
  let apiFetchOptions;
  try {
    apiFetchOptions = await current.chatAuth.get(
      current.user.current,
      current.user.visitor,
      clientKey,
      current.journalEntryRef
    );
  } catch (e) {
    setVWC(stateVWC, {
      type: 'error',
      error: e instanceof DisplayableError ? e : new DisplayableError('client', ACTION, `${e}`),
    });
    return;
  }

  setVWC(stateVWC, {
    type: 'incremental-refresh-authorizing',
    journalEntryRef: current.journalEntryRef,
    user: current.user,
    value: current.value,
    clientKey: {
      current: clientKey,
    },
    progress: createSmartAPIFetch(apiFetchOptions),
  });
};

const transitionFromIncrementalRefreshAuthorizing = async (
  stateVWC: WritableValueWithCallbacks<State>,
  messageVWC: WritableValueWithCallbacks<Message | null>
) => {
  const current = stateVWC.get();
  if (current.type !== 'incremental-refresh-authorizing') {
    throw new Error(current.type);
  }

  const messageCancelable = receiveMessageWithVWC(messageVWC);
  messageCancelable.promise.catch(() => {});
  const authorizedCancelable = waitForValueWithCallbacksConditionCancelable(
    current.progress.state,
    (s) => s.type !== 'in-flight' && s.type !== 'waiting'
  );
  authorizedCancelable.promise.catch(() => {});
  await Promise.race([messageCancelable.promise, authorizedCancelable.promise]);
  if (messageCancelable.done()) {
    authorizedCancelable.cancel();
    if (current.progress.state.get().type !== 'released') {
      current.progress.sendMessage({ type: 'release' });
    }

    setVWC(stateVWC, { type: 'released' });
    const msg = (await messageCancelable.promise)();
    if (msg.type !== 'release') {
      throw new Error(`unexpected msg in ${current.type}: ${JSON.stringify(msg)}`);
    }
    return;
  }
  messageCancelable.cancel();
  authorizedCancelable.cancel();

  const authorizeResult = current.progress.state.get();
  if (authorizeResult.type !== 'released') {
    current.progress.sendMessage({ type: 'release' });
  }

  if (authorizeResult.type !== 'success') {
    setVWC(stateVWC, {
      type: 'error',
      error:
        authorizeResult.type === 'error'
          ? authorizeResult.error
          : new DisplayableError('client', ACTION, `authorize state: ${authorizeResult.type}`),
    });
    return;
  }

  const chatState: JournalChatState = {
    uid: authorizeResult.value.journal_entry_uid,
    integrity: '',
    data: [],
    transient: null,
  };
  chatState.integrity = await computeJournalChatStateDataIntegrity(chatState);

  setVWC(stateVWC, {
    type: 'catching-up',
    journalEntryRef: {
      uid: authorizeResult.value.journal_entry_uid,
      jwt: authorizeResult.value.journal_entry_jwt,
    },
    chatAuth: {
      current: {
        jwt: authorizeResult.value.journal_chat_jwt,
      },
    },
    user: current.user,
    clientKey: current.clientKey,
    websocket: createSmartWebsocketConnectForJournalChat(authorizeResult.value.journal_chat_jwt),
    value: {
      old: current.value.confirmed,
      anticipated: current.value.anticipated,
      received: createWritableValueWithCallbacks<JournalChatState>(chatState),
      displayable: current.value.displayable,
    },
  });
};

const transitionFromCatchingUp = async (
  stateVWC: WritableValueWithCallbacks<State>,
  messageVWC: WritableValueWithCallbacks<Message | null>
) => {
  const current = stateVWC.get();
  if (current.type !== 'catching-up') {
    throw new Error(current.type);
  }

  const messageCancelable = receiveMessageWithVWC(messageVWC);
  messageCancelable.promise.catch(() => {});
  const socketClosedCancelable = waitForValueWithCallbacksConditionCancelable(
    current.websocket.state,
    (s) => s.type === 'closed' || s.type === 'error' || s.type === 'released'
  );
  socketClosedCancelable.promise.catch(() => {});

  let sawFinalPacket = false;
  while (true) {
    if (messageCancelable.done()) {
      socketClosedCancelable.cancel();
      if (current.websocket.state.get().type !== 'released') {
        current.websocket.sendMessage({ type: 'release' });
      }
      setVWC(stateVWC, { type: 'released' });
      const msg = (await messageCancelable.promise)();
      if (msg.type !== 'release') {
        throw new Error(`unexpected msg in ${current.type}: ${JSON.stringify(msg)}`);
      }
      return;
    }

    const wsState = current.websocket.state.get();
    const incomingVWC =
      wsState.type === 'open' || wsState.type === 'closed' ? wsState.value.incoming : null;
    if (incomingVWC !== null) {
      const incoming = incomingVWC.get().shift();
      if (incoming !== undefined) {
        incomingVWC.callbacks.call(undefined);
        try {
          const { more } = await applyIncomingMessage(
            current.value.received.get(),
            incoming,
            current.clientKey.current
          );
          current.value.received.callbacks.call(undefined);
          if (!more) {
            sawFinalPacket = true;
            break;
          }

          const currentReceived = current.value.received.get();
          if (!isAnticipatedStateStillPlausible(current.value.anticipated, currentReceived)) {
            console.log('switching to streaming as state is no longer plausible');
            console.log('  anticipated:', deepClonePrimitives(current.value.anticipated));
            console.log('  received:', deepClonePrimitives(currentReceived));
            messageCancelable.cancel();
            socketClosedCancelable.cancel();
            setVWC(stateVWC, {
              type: 'streaming',
              journalEntryRef: current.journalEntryRef,
              chatAuth: current.chatAuth,
              user: current.user,
              clientKey: current.clientKey,
              websocket: current.websocket,
              value: {
                displayable: createWritableValueWithCallbacks(currentReceived),
              },
            });
            return;
          }
        } catch (e) {
          messageCancelable.cancel();
          socketClosedCancelable.cancel();
          if (current.websocket.state.get().type !== 'released') {
            current.websocket.sendMessage({ type: 'release' });
          }
          setVWC(stateVWC, {
            type: 'error',
            error:
              e instanceof DisplayableError ? e : new DisplayableError('client', ACTION, `${e}`),
          });
          return;
        }
        continue;
      }
    }

    if (socketClosedCancelable.done()) {
      break;
    }

    const haveIncomingMessage =
      incomingVWC !== null
        ? waitForValueWithCallbacksConditionCancelable(incomingVWC, (v) => v.length > 0)
        : waitForValueWithCallbacksConditionCancelable(
            current.websocket.state,
            (s) => s.type === 'open' || s.type === 'closed'
          );
    haveIncomingMessage.promise.catch(() => {});

    await Promise.race([
      messageCancelable.promise,
      socketClosedCancelable.promise,
      haveIncomingMessage.promise,
    ]);

    haveIncomingMessage.cancel();
  }

  // either we are in error, released, closed with no incoming, or open but we saw a final packet
  messageCancelable.cancel();
  socketClosedCancelable.cancel();

  const currentWSState = current.websocket.state.get();
  if (currentWSState.type !== 'released') {
    current.websocket.sendMessage({ type: 'release' });
  }

  if (!sawFinalPacket) {
    if (currentWSState.type === 'error') {
      setVWC(stateVWC, {
        type: 'error',
        error: currentWSState.error,
      });
      return;
    }

    setVWC(stateVWC, {
      type: 'error',
      error: new DisplayableError('client', ACTION, 'did not see final packet'),
    });
    return;
  }

  setVWC(stateVWC, {
    type: 'ready',
    journalEntryRef: current.journalEntryRef,
    user: current.user,
    value: { displayable: current.value.received },
  });
};

const transitionFromError = async (
  stateVWC: WritableValueWithCallbacks<State>,
  messageVWC: WritableValueWithCallbacks<Message | null>
) => {
  const current = stateVWC.get();
  if (current.type !== 'error') {
    throw new Error(current.type);
  }

  const msg = (await receiveMessageWithVWC(messageVWC).promise)();
  setVWC(stateVWC, { type: 'released' });
  if (msg.type === 'release') {
    return;
  }
  throw new Error(`unexpected msg in ${current.type}: ${JSON.stringify(msg)}`);
};

/**
 * Creates a new journal entry state machine from a ref with no anticipated
 * state. Starts in the `initializing` state.
 */
export const createJournalEntryStateMachine = ({
  loginContext,
  visitor,
  journalEntry,
}: {
  /** The login context to use for the upload */
  loginContext: LoginContextValue;

  /** The visitor who is using the client */
  visitor: Visitor;

  /** the journal entry to sync */
  journalEntry: { uid: string; jwt: string };
}): JournalEntryStateMachine => {
  const state = createWritableValueWithCallbacks<State>({
    type: 'initializing',
    journalEntryRef: journalEntry,
    user: {
      loginContext,
      visitor,
    },
  });

  const message = createWritableValueWithCallbacks<Message | null>(null);
  manageLoop(state, message);
  return {
    state,
    sendMessage: (msg) => passMessageWithVWC(message, msg),
  };
};

export const isExpiredOrDisposed = (
  machine: JournalEntryStateMachine,
  nowServerMS: number
): boolean => {
  const state = machine.state.get();
  if (state.type === 'released' || state.type === 'error') {
    return true;
  }

  if (
    state.type === 'incremental-refresh' ||
    state.type === 'incremental-refresh-preparing-references' ||
    state.type === 'incremental-refresh-preparing-client-key' ||
    state.type === 'incremental-refresh-authorizing'
  ) {
    return false;
  }

  const jwtExpiresAt = getJwtExpiration(state.journalEntryRef.jwt);
  return jwtExpiresAt <= nowServerMS;
};
