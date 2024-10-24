import { HTTP_WEBSOCKET_URL } from '../ApiConstants';
import {
  createWritableValueWithCallbacks,
  ValueWithCallbacks,
  WritableValueWithCallbacks,
} from './Callbacks';
import { CancelablePromise } from './CancelablePromise';
import { createCancelableTimeout } from './createCancelableTimeout';
import { DisplayableError } from './errors';
import { passMessageWithVWC } from './passMessageWithVWC';
import { receiveMessageWithVWC } from './receiveMessageWithVWC';
import { setVWC } from './setVWC';
import {
  retryerExpoBackoff3,
  retryerForever5,
  retryerNever,
  SmartAPIFetchRetryer,
  SmartAPIFetchRetryerPreset,
} from './smartApiFetch';
import { waitForValueWithCallbacksConditionCancelable } from './waitForValueWithCallbacksCondition';

/**
 * Sends the client greeting over the websocket and waits for a response.
 */
export type SmartWebsocketGreeter<T extends {} | null> = (
  incoming: WritableValueWithCallbacks<(string | ArrayBuffer)[]>,
  outgoing: WritableValueWithCallbacks<(string | ArrayBuffer) | null>,
  websocketState: ValueWithCallbacks<'open' | 'closed'>
) => CancelablePromise<T>;

export type SmartWebsocketConnectStateInFlight<T extends {} | null> = {
  /**
   * - `in-flight`: we currently have a request in flight and are waiting for the response
   */
  type: 'in-flight';
  /**
   * the number of previous attempts that have failed; i.e., if this is `0` then it is
   * the first attempt
   */
  attempt: number;
  /**
   * the local time (`Date.now()`) when the request was initiated
   */
  startedAt: number;

  /** the request we are trying to perform */
  request: {
    /** the path to the websocket endpoint */
    path: string;
    /** the function responsible for sending the greeting and getting acknowledgement */
    greeter: SmartWebsocketGreeter<T>;
  };

  /** determines how many times to retry and the delays between */
  retryer: SmartAPIFetchRetryer;

  /** we guarrantee this is undefined for convenience */
  value?: undefined;
};

export type SmartWebsocketConnectStateWaiting<T extends {} | null> = {
  /**
   * - `waiting`: we do not have a request in flight but we do intend on making one
   */
  type: 'waiting';

  /**
   * the number of previous attempts that have failed; i.e., if this is `0` then we are
   * waiting to make the first request (usually because we are initializing still)
   */
  attempt: number;

  /**
   * approximately when (in local time, as if via `Date.now()`) we will make the next
   * request
   */
  nextAttemptAt: number;

  /** the request we are trying to perform */
  request: {
    /** the path to the endpoint */
    path: string;
    /** the function responsible for sending the greeting and getting acknowledgement */
    greeter: SmartWebsocketGreeter<T>;
  };

  /** determines how many times to retry and the delays between */
  retryer: SmartAPIFetchRetryer;

  /** we guarrantee this is undefined for convenience */
  value?: undefined;
};

export type SmartWebsocketConnectStateOpen<T extends {} | null> = {
  /**
   * - `open`: the websocket is open
   */
  type: 'open';

  /**
   * the number of previous attempts that have failed; i.e., if this is `0` then this
   * is the first attempt
   */
  attempt: number;

  /** the request we are trying to perform */
  request: {
    /** the path to the endpoint */
    path: string;
    /** the function responsible for sending the greeting and getting acknowledgement */
    greeter: SmartWebsocketGreeter<T>;
  };

  /**
   * The result of running the mapping function on the response
   */
  value: {
    /**
     * the response to the greeting; if this is meaningful, usually negotiates
     * functionality
     */
    greeting: T;
    /**
     * The incoming messages that haven't been processed,
     * in order from oldest (at index 0) to newest
     */
    incoming: WritableValueWithCallbacks<(string | ArrayBuffer)[]>;
    /**
     * The pending outgoing write or null if there isn't one; cleared once queued
     */
    outgoing: WritableValueWithCallbacks<(string | ArrayBuffer) | null>;
    /** the underlying websocket: not recommended to use directly */
    websocket: WebSocket;
  };

  /** determines how many times to retry and the delays between */
  retryer: SmartAPIFetchRetryer;
};

export type SmartWebsocketConnectStateClosed<T extends {} | null> = {
  /**
   * - `closed`: the websocket is closed; there may be additional messages to process
   */
  type: 'closed';

  /**
   * the number of previous attempts that have failed; i.e., if this is `0` then this
   * is the first attempt
   */
  attempt: number;

  /** the request we are trying to perform */
  request: {
    /** the path to the endpoint */
    path: string;
    /** the function responsible for sending the greeting and getting acknowledgement */
    greeter: SmartWebsocketGreeter<T>;
  };

  /**
   * The result of running the mapping function on the response
   */
  value: {
    /**
     * the response to the greeting; if this is meaningful, usually negotiates
     * functionality
     */
    greeting: T;
    /**
     * The incoming messages that haven't been processed,
     * in order from oldest (at index 0) to newest
     */
    incoming: WritableValueWithCallbacks<(string | ArrayBuffer)[]>;
  };

  /** determines how many times to retry and the delays between */
  retryer: SmartAPIFetchRetryer;
};

export type SmartWebsocketConnectStateError = {
  /**
   * - `error`: something went wrong
   */
  type: 'error';

  /**
   * the error that occurred as it can be shown to the user
   */
  error: DisplayableError;

  /** we guarrantee this is undefined for convenience */
  value?: undefined;
};

export type SmartWebsocketConnectStateReleased = {
  /**
   * - `released`: the request has been released
   */
  type: 'released';

  /** we guarrantee this is undefined for convenience */
  value?: undefined;
};

export type SmartWebsocketConnectState<T extends {} | null> =
  | SmartWebsocketConnectStateInFlight<T>
  | SmartWebsocketConnectStateWaiting<T>
  | SmartWebsocketConnectStateOpen<T>
  | SmartWebsocketConnectStateClosed<T>
  | SmartWebsocketConnectStateError
  | SmartWebsocketConnectStateReleased;

export type SmartWebsocketConnectOptions<T extends {} | null> = {
  /** the path to the endpoint that accepts websockets */
  path: string;

  /** manages the initial websocket greeting */
  greeter: SmartWebsocketGreeter<T>;

  /**
   * The retryer function to use or a preset
   */
  retryer: SmartAPIFetchRetryerPreset | SmartAPIFetchRetryer | 'default';
};

export type SmartWebsocketConnectMessageRelease = {
  /**
   * - `release`: request that we transition to the released state, ending
   *   the state machine and closing the websocket (if open)
   */
  type: 'release';
};

export type SmartWebsocketConnectMessageRetry = {
  /**
   * - `retry`: used to indicate that the server wants us to reconnect or
   *   closed the connection without a terminal message
   */
  type: 'retry';

  /**
   * if the server indicated we should wait a minimum of a given duration
   * in milliseconds, that duration. we will wait the longer of this duration
   * and the retryer's delay
   */
  retryAfterMS?: number;
};

export type SmartWebsocketConnectMessage =
  | SmartWebsocketConnectMessageRelease
  | SmartWebsocketConnectMessageRetry;

/**
 * Describes a releasable websocket with automatic retries for the initial connect
 * that you can inspect. Unlike with smart api fetches we may need to retry despite
 * a "successful" connection, and hence we have another message type
 */
export type SmartWebsocketConnect<T extends {} | null> = {
  /** Allows inspecting the current state of the state machine */
  state: ValueWithCallbacks<SmartWebsocketConnectState<T>>;
  /**
   * Sends a message to the current state machine if it's not released and returns
   * a promise that resolves when the message was processed
   *
   * If the state machine is already in the released state, this will throw an error
   * instead
   */
  sendMessage: (msg: SmartWebsocketConnectMessage) => CancelablePromise<void>;
};

async function manageLoop<T extends {} | null>(
  stateVWC: WritableValueWithCallbacks<SmartWebsocketConnectState<T>>,
  messageVWC: WritableValueWithCallbacks<SmartWebsocketConnectMessage | null>
) {
  while (true) {
    const current = stateVWC.get();
    switch (current.type) {
      case 'in-flight':
        await transitionFromInFlight(stateVWC, messageVWC);
        break;
      case 'waiting':
        await transitionFromWaiting(stateVWC, messageVWC);
        break;
      case 'open':
        await transitionFromOpen(stateVWC, messageVWC);
        break;
      case 'closed':
        await transitionFromClosed(stateVWC, messageVWC);
        break;
      case 'error':
        await transitionFromError(stateVWC, messageVWC);
        break;
      case 'released':
        return;
      default:
        throw new Error(`bad state: ${JSON.stringify(current)}`);
    }
  }
}

async function transitionFromWaiting<T extends {} | null>(
  stateVWC: WritableValueWithCallbacks<SmartWebsocketConnectState<T>>,
  messageVWC: WritableValueWithCallbacks<SmartWebsocketConnectMessage | null>
) {
  const current = stateVWC.get();
  if (current.type !== 'waiting') {
    throw new Error(current.type);
  }

  {
    const now = Date.now();
    if (now < current.nextAttemptAt) {
      const timeoutPromise = createCancelableTimeout(current.nextAttemptAt - now);
      timeoutPromise.promise.catch(() => {});
      const messagePromise = receiveMessageWithVWC(messageVWC);
      messagePromise.promise.catch(() => {});
      await Promise.race([timeoutPromise.promise, messagePromise.promise]);
      timeoutPromise.cancel();
      if (messagePromise.done()) {
        const msg = (await messagePromise.promise)();
        setVWC(stateVWC, { type: 'released' });
        if (msg.type === 'release') {
          return;
        }
        throw new Error(`unexpected msg in ${current.type}: ${msg.type}`);
      }
      messagePromise.cancel();
    }
  }

  setVWC(stateVWC, {
    type: 'in-flight',
    attempt: current.attempt,
    startedAt: Date.now(),
    request: {
      path: current.request.path,
      greeter: current.request.greeter,
    },
    retryer: current.retryer,
  });
}

async function transitionFromInFlight<T extends {} | null>(
  stateVWC: WritableValueWithCallbacks<SmartWebsocketConnectState<T>>,
  messageVWC: WritableValueWithCallbacks<SmartWebsocketConnectMessage | null>
) {
  const current = stateVWC.get();
  if (current.type !== 'in-flight') {
    throw new Error(current.type);
  }

  let websocket: WebSocket;
  try {
    websocket = new WebSocket(HTTP_WEBSOCKET_URL + current.request.path);
    websocket.binaryType = 'arraybuffer';
  } catch {
    setVWC(stateVWC, {
      type: 'error',
      error: new DisplayableError('connectivity', 'create websocket'),
    });
    return;
  }

  const incoming = createWritableValueWithCallbacks<(string | ArrayBuffer)[]>([]);
  const outgoing = createWritableValueWithCallbacks<(string | ArrayBuffer) | null>(null);
  const wsState = createWritableValueWithCallbacks<'initializing' | 'open' | 'closed'>('open');

  const cleanupWSState = (() => {
    const onOpen = () => {
      setVWC(wsState, 'open');
    };

    websocket.addEventListener('open', onOpen);

    const onClose = () => {
      setVWC(wsState, 'closed');
    };

    websocket.addEventListener('close', onClose);

    const onError = (e: Event) => {
      console.log('websocket error', e);
      setVWC(wsState, 'closed');
    };

    websocket.addEventListener('error', onError);

    if (websocket.readyState === WebSocket.CONNECTING) {
      setVWC(wsState, 'initializing');
    } else if (websocket.readyState === WebSocket.OPEN) {
      setVWC(wsState, 'open');
    } else {
      setVWC(wsState, 'closed');
    }

    return () => {
      websocket.removeEventListener('open', onOpen);
      websocket.removeEventListener('close', onClose);
      websocket.removeEventListener('error', onError);
    };
  })();

  websocket.addEventListener('message', (e) => {
    incoming.get().push(e.data);
    incoming.callbacks.call(undefined);
  });

  const wsNotInitializing = waitForValueWithCallbacksConditionCancelable(
    wsState,
    (s) => s !== 'initializing'
  );
  wsNotInitializing.promise.catch(() => {});
  const msgReceived = receiveMessageWithVWC(messageVWC);
  msgReceived.promise.catch(() => {});
  await Promise.race([wsNotInitializing.promise, msgReceived.promise]);
  wsNotInitializing.cancel();
  if (msgReceived.done()) {
    cleanupWSState();
    try {
      websocket.close();
    } catch {}

    const msg = (await msgReceived.promise)();
    setVWC(stateVWC, { type: 'released' });

    if (msg.type !== 'release') {
      throw new Error(`unexpected msg in ${current.type}: ${msg.type}`);
    }
    return;
  }

  const newWSState = wsState.get();
  if (newWSState !== 'open') {
    cleanupWSState();
    msgReceived.cancel();
    try {
      websocket.close();
    } catch {}

    const nextAttempt = current.retryer(current.attempt, null);
    if (nextAttempt.delay !== undefined) {
      setVWC(stateVWC, {
        type: 'waiting',
        attempt: current.attempt + 1,
        nextAttemptAt: Date.now() + nextAttempt.delay,
        request: current.request,
        retryer: current.retryer,
      });
      return;
    }

    setVWC(stateVWC, {
      type: 'error',
      error: nextAttempt.error,
    });
    return;
  }

  const greeterDone = current.request.greeter(
    incoming,
    outgoing,
    wsState as ValueWithCallbacks<'open' | 'closed'>
  );
  greeterDone.promise.catch(() => {});
  const wsClosed = waitForValueWithCallbacksConditionCancelable(wsState, (s) => s === 'closed');
  wsClosed.promise.catch(() => {});
  while (true) {
    const needSendMessage = receiveMessageWithVWC(outgoing);
    await Promise.race([
      greeterDone.promise,
      msgReceived.promise,
      needSendMessage.promise,
      wsClosed.promise,
    ]);
    if (greeterDone.done()) {
      needSendMessage.cancel();
      break;
    }
    if (msgReceived.done()) {
      cleanupWSState();
      needSendMessage.cancel();
      greeterDone.cancel();
      wsClosed.cancel();
      try {
        websocket.close();
      } catch {}
      const msg = (await msgReceived.promise)();
      setVWC(stateVWC, { type: 'released' });
      if (msg.type !== 'release') {
        throw new Error(`unexpected msg in ${current.type}: ${msg.type}`);
      }
      return;
    }
    if (wsState.get() !== 'open') {
      cleanupWSState();
      needSendMessage.cancel();
      greeterDone.cancel();
      msgReceived.cancel();
      wsClosed.cancel();

      const nextAttempt = current.retryer(current.attempt, null);
      if (nextAttempt.delay !== undefined) {
        setVWC(stateVWC, {
          type: 'waiting',
          attempt: current.attempt + 1,
          nextAttemptAt: Date.now() + nextAttempt.delay,
          request: current.request,
          retryer: current.retryer,
        });
        return;
      }

      setVWC(stateVWC, {
        type: 'error',
        error: nextAttempt.error,
      });
      return;
    }
    if (needSendMessage.done()) {
      const toSend = (await needSendMessage.promise)();
      try {
        websocket.send(toSend);
      } catch (e) {
        const err = new DisplayableError('client', 'send websocket', `${e}`);
        cleanupWSState();
        msgReceived.cancel();
        wsClosed.cancel();
        needSendMessage.cancel();
        greeterDone.cancel();
        try {
          websocket.close();
        } catch {}
        setVWC(stateVWC, { type: 'error', error: err });
        return;
      }
    } else {
      needSendMessage.cancel();
    }
  }
  wsClosed.cancel();
  msgReceived.cancel();

  let greeterResult: T;
  try {
    greeterResult = await greeterDone.promise;
  } catch (e) {
    msgReceived.cancel();
    try {
      websocket.close();
    } catch {}

    const err =
      e instanceof DisplayableError ? e : new DisplayableError('client', 'greet websocket', `${e}`);

    if (
      err.type === 'connectivity' ||
      err.type === 'server-retryable' ||
      err.type === 'server-ratelimited'
    ) {
      const nextAttempt = current.retryer(current.attempt, null);
      if (nextAttempt.delay !== undefined) {
        setVWC(stateVWC, {
          type: 'waiting',
          attempt: current.attempt + 1,
          nextAttemptAt: Date.now() + nextAttempt.delay,
          request: current.request,
          retryer: current.retryer,
        });
        return;
      }
    }

    setVWC(stateVWC, { type: 'error', error: err });
    return;
  }

  cleanupWSState();

  // purposely keep onMessage so we dont miss any

  setVWC(stateVWC, {
    type: 'open',
    attempt: current.attempt,
    request: current.request,
    value: {
      greeting: greeterResult,
      incoming,
      outgoing,
      websocket,
    },
    retryer: current.retryer,
  });
}

async function transitionFromOpen<T extends {} | null>(
  stateVWC: WritableValueWithCallbacks<SmartWebsocketConnectState<T>>,
  messageVWC: WritableValueWithCallbacks<SmartWebsocketConnectMessage | null>
) {
  const current = stateVWC.get();
  if (current.type !== 'open') {
    throw new Error(current.type);
  }

  const wsState = createWritableValueWithCallbacks<'open' | 'closed'>('open');
  const cleanupWSState = (() => {
    const setClosed = () => {
      setVWC(wsState, 'closed');
    };
    current.value.websocket.addEventListener('close', setClosed);
    current.value.websocket.addEventListener('error', setClosed);
    if (current.value.websocket.readyState !== WebSocket.OPEN) {
      setVWC(wsState, 'closed');
    }
    return () => {
      current.value.websocket.removeEventListener('close', setClosed);
      current.value.websocket.removeEventListener('error', setClosed);
    };
  })();

  const msgReceived = receiveMessageWithVWC(messageVWC);
  const wsClosed = waitForValueWithCallbacksConditionCancelable(wsState, (s) => s === 'closed');

  while (true) {
    const needSendMessage = receiveMessageWithVWC(current.value.outgoing);
    await Promise.race([msgReceived.promise, needSendMessage.promise, wsClosed.promise]);

    if (wsState.get() === 'closed') {
      cleanupWSState();
      msgReceived.cancel();
      wsClosed.cancel();
      needSendMessage.cancel();
      setVWC(stateVWC, {
        type: 'closed',
        attempt: current.attempt,
        request: current.request,
        value: {
          greeting: current.value.greeting,
          incoming: current.value.incoming,
        },
        retryer: current.retryer,
      });
      return;
    }

    if (msgReceived.done()) {
      cleanupWSState();
      wsClosed.cancel();
      needSendMessage.cancel();
      try {
        current.value.websocket.close();
      } catch {}
      const msg = (await msgReceived.promise)();

      if (msg.type === 'retry') {
        const nextAttempt = current.retryer(current.attempt, msg.retryAfterMS ?? null);
        if (nextAttempt.delay !== undefined) {
          setVWC(stateVWC, {
            type: 'waiting',
            attempt: current.attempt + 1,
            nextAttemptAt: Date.now() + nextAttempt.delay,
            request: current.request,
            retryer: current.retryer,
          });
          return;
        }

        setVWC(stateVWC, { type: 'released' });
        return;
      }

      setVWC(stateVWC, {
        type: 'released',
      });
      if (msg.type !== 'release') {
        throw new Error(`unexpected msg in ${current.type}: ${JSON.stringify(msg)}`);
      }
      return;
    }

    if (needSendMessage.done()) {
      const toSend = (await needSendMessage.promise)();
      try {
        current.value.websocket.send(toSend);
      } catch (e) {
        const err = new DisplayableError('client', 'send websocket', `${e}`);
        cleanupWSState();
        msgReceived.cancel();
        wsClosed.cancel();
        needSendMessage.cancel();
        try {
          current.value.websocket.close();
        } catch {}
        setVWC(stateVWC, { type: 'error', error: err });
        return;
      }
    } else {
      needSendMessage.cancel();
    }
  }
}

async function transitionFromClosed<T extends {} | null>(
  stateVWC: WritableValueWithCallbacks<SmartWebsocketConnectState<T>>,
  messageVWC: WritableValueWithCallbacks<SmartWebsocketConnectMessage | null>
) {
  const current = stateVWC.get();
  if (current.type !== 'closed') {
    throw new Error(current.type);
  }

  const msg = (await receiveMessageWithVWC(messageVWC).promise)();

  if (msg.type === 'retry') {
    const nextAttempt = current.retryer(current.attempt, msg.retryAfterMS ?? null);
    if (nextAttempt.delay !== undefined) {
      setVWC(stateVWC, {
        type: 'waiting',
        attempt: current.attempt + 1,
        nextAttemptAt: Date.now() + nextAttempt.delay,
        request: current.request,
        retryer: current.retryer,
      });
      return;
    }

    setVWC(stateVWC, { type: 'released' });
    return;
  }

  setVWC(stateVWC, { type: 'released' });
  if (msg.type !== 'release') {
    throw new Error(`unexpected msg in ${current.type}: ${JSON.stringify(msg)}`);
  }
}

async function transitionFromError<T extends {} | null>(
  stateVWC: WritableValueWithCallbacks<SmartWebsocketConnectState<T>>,
  messageVWC: WritableValueWithCallbacks<SmartWebsocketConnectMessage | null>
) {
  const current = stateVWC.get();
  if (current.type !== 'error') {
    throw new Error(current.type);
  }

  const msg = (await receiveMessageWithVWC(messageVWC).promise)();
  setVWC(stateVWC, { type: 'released' });
  if (msg.type !== 'release') {
    throw new Error(`unexpected msg in ${current.type}: ${msg.type}`);
  }
}

/**
 * A wrapper around `WebSocket` that manages retries for the initial connect
 * and gives an easier to work with interface to the incoming and outgoing
 * packets, provided that you can keep up with them.
 */
export function createSmartWebsocketConnect<T extends {} | null>({
  path,
  greeter,
  retryer,
}: SmartWebsocketConnectOptions<T>): SmartWebsocketConnect<T> {
  if (typeof retryer === 'string') {
    if (retryer === 'never') {
      retryer = retryerNever;
    } else if (retryer === 'expo-backoff-3' || retryer === 'default') {
      retryer = retryerExpoBackoff3;
    } else if (retryer === 'forever-5') {
      retryer = retryerForever5;
    } else {
      ((v: never) => {
        throw new Error(`unknown retryer preset: ${v}`);
      })(retryer);
    }
  }
  const stateVWC = createWritableValueWithCallbacks<SmartWebsocketConnectState<T>>({
    type: 'waiting',
    attempt: 0,
    nextAttemptAt: Date.now(),
    request: { path, greeter },
    retryer,
  });
  const messageVWC = createWritableValueWithCallbacks<SmartWebsocketConnectMessage | null>(null);
  manageLoop(stateVWC, messageVWC);
  return {
    state: stateVWC,
    sendMessage: (msg) => {
      if (stateVWC.get().type === 'released') {
        throw new Error('cannot send message to released state');
      }
      return passMessageWithVWC(messageVWC, msg);
    },
  };
}
