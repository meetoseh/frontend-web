import {
  createWritableValueWithCallbacks,
  ValueWithCallbacks,
  WritableValueWithCallbacks,
} from './Callbacks';
import { LoginContextValueLoggedIn } from '../contexts/LoginContext';
import { createCancelableTimeout } from './createCancelableTimeout';
import { receiveMessageWithVWC } from './receiveMessageWithVWC';
import { setVWC } from './setVWC';
import { apiFetch } from '../ApiConstants';
import { CancelablePromise } from './CancelablePromise';
import { passMessageWithVWC } from './passMessageWithVWC';
import { DisplayableError } from './errors';

export type SmartAPIFetchMapper<T extends {} | null> = (
  response: Response
) => Promise<
  | { value: T; error?: undefined }
  | { value?: undefined; error: DisplayableError; retryable: boolean }
>;

export type SmartAPIUserGetter = () =>
  | { user: LoginContextValueLoggedIn | null; error?: undefined }
  | { user?: undefined; error: DisplayableError };

export type SmartAPIFetchRetryer = (
  attempt: number,
  retryAfterMS: number | null
) => { delay: number; error?: undefined } | { delay?: undefined; error: DisplayableError };

export type SmartAPIFetchRequestInit = Omit<RequestInit, 'signal'> & { signal?: undefined };

export type SmartAPIFetchStateInFlight<T extends {} | null> = {
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
    /** the path to the endpoint */
    path: string;
    /** the init body */
    init: SmartAPIFetchRequestInit;
    /** the user we are setting the authorization header to */
    user: LoginContextValueLoggedIn | null;
    /** used to refresh the user  */
    userRefresher: SmartAPIUserGetter;
    /** the mapper when we get a response */
    mapper: SmartAPIFetchMapper<T>;
  };
  /** determines how many times to retry and the delays between */
  retryer: SmartAPIFetchRetryer;

  /** we guarrantee this is undefined for convenience */
  value?: undefined;
};

export type SmartAPIFetchStateWaiting<T extends {} | null> = {
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
    /** the init body */
    init: SmartAPIFetchRequestInit;
    /** used to get the user  */
    userRefresher: SmartAPIUserGetter;
    /** the mapper when we get a response */
    mapper: SmartAPIFetchMapper<T>;
  };

  /** determines how many times to retry and the delays between */
  retryer: SmartAPIFetchRetryer;

  /** we guarrantee this is undefined for convenience */
  value?: undefined;
};

export type SmartAPIFetchStateSuccess<T extends {} | null> = {
  /**
   * - `success`: the request was successful and we have received the data
   */
  type: 'success';

  /**
   * The result of running the mapping function on the response
   */
  value: T;
};

export type SmartAPIFetchStateError = {
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

export type SmartAPIFetchStateReleased = {
  /**
   * - `released`: the request has been released
   */
  type: 'released';

  /** we guarrantee this is undefined for convenience */
  value?: undefined;
};

export type SmartAPIFetchState<T extends {} | null> =
  | SmartAPIFetchStateInFlight<T>
  | SmartAPIFetchStateWaiting<T>
  | SmartAPIFetchStateSuccess<T>
  | SmartAPIFetchStateError
  | SmartAPIFetchStateReleased;

export type SmartAPIFetchMessageRelease = {
  /**
   * - `release`: request that we transition to the released state, ending
   *   the state machine. Once this message is processed, no more messages
   *   can be sent
   */
  type: 'release';
};

export type SmartAPIFetchMessage = SmartAPIFetchMessageRelease;

async function manageLoop<T extends {} | null>(
  stateVWC: WritableValueWithCallbacks<SmartAPIFetchState<T>>,
  messageVWC: WritableValueWithCallbacks<SmartAPIFetchMessage | null>
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
      case 'success':
      case 'error':
        await transitionFromFinal(stateVWC, messageVWC);
        break;
      case 'released':
        return;
      default:
        throw new Error(current);
    }
  }
}

async function transitionFromWaiting<T extends {} | null>(
  stateVWC: WritableValueWithCallbacks<SmartAPIFetchState<T>>,
  messageVWC: WritableValueWithCallbacks<SmartAPIFetchMessage | null>
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

  const user = current.request.userRefresher();
  if (user.error !== undefined) {
    setVWC(stateVWC, { type: 'error', error: user.error });
    return;
  }

  setVWC(stateVWC, {
    type: 'in-flight',
    attempt: current.attempt,
    startedAt: Date.now(),
    request: {
      path: current.request.path,
      init: current.request.init,
      user: user.user,
      userRefresher: current.request.userRefresher,
      mapper: current.request.mapper,
    },
    retryer: current.retryer,
  });
}

async function transitionFromInFlight<T extends {} | null>(
  stateVWC: WritableValueWithCallbacks<SmartAPIFetchState<T>>,
  messageVWC: WritableValueWithCallbacks<SmartAPIFetchMessage | null>
) {
  const current = stateVWC.get();
  if (current.type !== 'in-flight') {
    throw new Error(current.type);
  }

  const controller = new AbortController();
  const signal = controller.signal;

  const messageCancelable = receiveMessageWithVWC(messageVWC);
  messageCancelable.promise.catch(() => {});

  if (messageVWC.get() !== null) {
    const msg = (await messageCancelable.promise)();
    setVWC(stateVWC, { type: 'released' });
    if (msg.type === 'release') {
      return;
    }
    throw new Error(`unexpected msg in ${current.type}: ${msg.type}`);
  }

  const responsePromise = apiFetch(
    current.request.path,
    {
      ...current.request.init,
      signal,
    },
    current.request.user
  );
  try {
    await Promise.race([messageCancelable.promise, responsePromise]);
  } catch {}

  if (messageCancelable.done()) {
    controller.abort();
  }

  let response: Response;
  try {
    response = await responsePromise;
  } catch {
    if (messageCancelable.done()) {
      const msg = (await messageCancelable.promise)();
      setVWC(stateVWC, { type: 'released' });
      if (msg.type === 'release') {
        return;
      }
      throw new Error(`unexpected msg in ${current.type}: ${msg.type}`);
    }

    const retry = current.retryer(current.attempt + 1, null);
    if (retry.error !== undefined) {
      setVWC(stateVWC, { type: 'error', error: retry.error });
      return;
    }

    setVWC(stateVWC, {
      type: 'waiting',
      attempt: current.attempt + 1,
      nextAttemptAt: Date.now() + retry.delay,
      request: {
        path: current.request.path,
        init: current.request.init,
        userRefresher: current.request.userRefresher,
        mapper: current.request.mapper,
      },
      retryer: current.retryer,
    });
    return;
  }

  if (messageCancelable.done()) {
    controller.abort();
  }

  let mapped: Awaited<ReturnType<SmartAPIFetchMapper<T>>>;
  try {
    mapped = await current.request.mapper(response);
  } catch (e) {
    if (messageCancelable.done()) {
      const msg = (await messageCancelable.promise)();
      setVWC(stateVWC, { type: 'released' });
      if (msg.type === 'release') {
        return;
      }
      throw new Error(`unexpected msg in ${current.type}: ${msg.type}`);
    }

    const described =
      e instanceof DisplayableError ? e : new DisplayableError('client', 'fetch', `${e}`);
    setVWC(stateVWC, { type: 'error', error: described });
    return;
  }

  messageCancelable.cancel();
  if (mapped.error !== undefined) {
    if (!mapped.retryable) {
      setVWC(stateVWC, { type: 'error', error: mapped.error });
      return;
    }

    let retryAfterMS: number | null = null;
    {
      const retryAfterRaw = response.headers.get('retry-after');
      if (retryAfterRaw !== null) {
        const retryAfterSeconds = parseInt(retryAfterRaw, 10);
        if (
          !isNaN(retryAfterSeconds) &&
          isFinite(retryAfterSeconds) &&
          retryAfterSeconds >= 0 &&
          retryAfterSeconds <= 180
        ) {
          retryAfterMS = retryAfterSeconds * 1000;
        }
      }
    }

    const retry = current.retryer(current.attempt + 1, retryAfterMS);
    if (retry.error !== undefined) {
      setVWC(stateVWC, { type: 'error', error: retry.error });
      return;
    }

    setVWC(stateVWC, {
      type: 'waiting',
      attempt: current.attempt + 1,
      nextAttemptAt: Date.now() + retry.delay,
      request: {
        path: current.request.path,
        init: current.request.init,
        userRefresher: current.request.userRefresher,
        mapper: current.request.mapper,
      },
      retryer: current.retryer,
    });
    return;
  }

  setVWC(stateVWC, { type: 'success', value: mapped.value });
}

async function transitionFromFinal<T extends {} | null>(
  stateVWC: WritableValueWithCallbacks<SmartAPIFetchState<T>>,
  messageVWC: WritableValueWithCallbacks<SmartAPIFetchMessage | null>
) {
  const current = stateVWC.get();
  if (current.type !== 'success' && current.type !== 'error') {
    throw new Error(current.type);
  }

  const timeout = createCancelableTimeout(10000);
  timeout.promise.catch(() => {});
  const message = receiveMessageWithVWC(messageVWC);
  message.promise.catch(() => {});
  await Promise.race([timeout.promise, message.promise]);
  timeout.cancel();
  if (message.done()) {
    const msg = (await message.promise)();
    setVWC(stateVWC, { type: 'released' });
    if (msg.type === 'release') {
      return;
    }
    throw new Error(`unexpected msg in ${current.type}: ${msg.type}`);
  }
  message.cancel();
  setVWC(stateVWC, { type: 'released' });

  throw new Error(`didn't cleanup smartApiFetch from ${current.type}`);
}

export type SmartAPIFetchRetryerPreset = 'never' | 'expo-backoff-3' | 'forever-5';

/**
 * Creates a basic exponential backoff retryer with some randomness
 */
export const createExponentialBackoffRetryer = (
  base: number,
  randomness: number,
  maxRetries: number
): SmartAPIFetchRetryer => {
  return (attempt: number, retryAfterMS: number | null) => {
    if (attempt >= maxRetries) {
      return { error: new DisplayableError('server-retryable', 'fetch') };
    }

    let delay = base * Math.pow(2, attempt) + Math.random() * randomness;
    if (retryAfterMS !== null) {
      delay = Math.max(delay, retryAfterMS);
    }
    return { delay };
  };
};

export const retryerExpoBackoff3 = createExponentialBackoffRetryer(1000, 1000, 3);
export const retryerNever: SmartAPIFetchRetryer = () => ({
  error: new DisplayableError('server-retryable', 'fetch', 'never retries'),
});
export const retryerForever5: SmartAPIFetchRetryer = (d) => ({
  delay: Math.max(d, 4500 + 1000 * Math.random()),
});

/**
 * Creates a typical smart api fetch mapper based on retrying typical
 * retryable status codes, then interpreting the body as json, then
 * calling the provided mapper
 */
export const createTypicalSmartAPIFetchMapper = <T extends {} | null>(
  mapJSON: (json: any) => T,
  action: string
): SmartAPIFetchMapper<T> => {
  return async (r) => {
    if (
      r.status === 429 ||
      r.status === 500 ||
      r.status === 502 ||
      r.status === 503 ||
      r.status === 504
    ) {
      return {
        error: new DisplayableError('server-retryable', action, `${r.status}`),
        retryable: true,
      };
    }

    try {
      const data = await r.json();
      return { value: mapJSON(data) };
    } catch {
      return { error: new DisplayableError('connectivity', action), retryable: true };
    }
  };
};

export type SmartAPIFetchOptions<T extends {} | null> = {
  /** the path to the endpoint to call */
  path: string;

  /** The request init parameters */
  init: SmartAPIFetchRequestInit;

  /**
   * The function that returns the user to use for authentication, or undefined not
   * to inject an authorization header ever.
   */
  user?: SmartAPIUserGetter | undefined;

  /**
   * The retryer function to use or a preset
   */
  retryer: SmartAPIFetchRetryerPreset | SmartAPIFetchRetryer;

  /**
   * The mapper function to use to convert from a response to a value
   */
  mapper: SmartAPIFetchMapper<T>;
};

/** Describes a releasable api fetch with automatic retries and that you can inspect */
export type SmartAPIFetch<T extends {} | null> = {
  /** Allows inspecting the current state of the state machine */
  state: ValueWithCallbacks<SmartAPIFetchState<T>>;
  /**
   * Sends a message to the current state machine if it's not released and returns
   * a promise that resolves when the message was processed
   *
   * If the state machine is already in the released state, this will throw an error
   * instead
   */
  sendMessage: (msg: SmartAPIFetchMessage) => CancelablePromise<void>;
};

/**
 * A wrapper around `apiFetch` that manages retries in a way that lets you inspect
 * the state at any time, but requires that you release the state machine when you
 * are done.
 *
 * If you do not release the state machine within 10s of it reaching a terminal
 * state (success or error), the state machine will release itself and raise an
 * uncatchable error
 */
export function createSmartAPIFetch<T extends {} | null>({
  path,
  init,
  user,
  retryer,
  mapper,
}: SmartAPIFetchOptions<T>): SmartAPIFetch<T> {
  if (typeof retryer === 'string') {
    if (retryer === 'never') {
      retryer = retryerNever;
    } else if (retryer === 'expo-backoff-3') {
      retryer = retryerExpoBackoff3;
    } else if (retryer === 'forever-5') {
      retryer = retryerForever5;
    } else {
      ((v: never) => {
        throw new Error(`unknown retryer preset: ${v}`);
      })(retryer);
    }
  }
  const userRefresher = user === undefined ? () => ({ user: null }) : user;
  const stateVWC = createWritableValueWithCallbacks<SmartAPIFetchState<T>>({
    type: 'waiting',
    attempt: 0,
    nextAttemptAt: Date.now(),
    request: { path, init, userRefresher, mapper },
    retryer,
  });
  const messageVWC = createWritableValueWithCallbacks<SmartAPIFetchMessage | null>(null);
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
