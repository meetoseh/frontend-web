import { ReactElement } from 'react';
import { CancelablePromise } from '../lib/CancelablePromise';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../lib/Callbacks';
import { createUID } from '../lib/createUID';
import { LeastRecentlyUsedCache } from '../lib/LeastRecentlyUsedCache';
import { describeError } from '../forms/ErrorBlock';
import { constructCancelablePromise } from '../lib/CancelablePromiseConstructor';
import { createCancelableTimeout } from '../lib/createCancelableTimeout';

type ResultSuccess<T extends object> = {
  /**
   * - **success**: Indicates that the data was retrieved successfully
   */
  type: 'success';
  data: T;
  error: undefined;
  retryAt: undefined;
};
type ResultReferenceIsExpired = {
  /**
   * - **expired**: Indicates that we did not attempt a request because the reference is expired
   */
  type: 'expired';
  data: undefined;
  /** A generic element describing that the reference is expired */
  error: ReactElement;
  retryAt: undefined;
};
type ResultAuthError = {
  /**
   * - **forbidden**: Indicates that we got a 403 forbidden response, which usually means our jwt was stale.
   *   It's expected that this is used only when we actually attempted the request, meaning we
   *   couldn't locally determine that the JWT was stale, i.e., we have a clock drift issue
   *   (or the JWT expired mid-request, i.e., high latency)
   */
  type: 'forbidden';
  data: undefined;
  /** An element describing the response */
  error: ReactElement;
  retryAt: undefined;
};
type ResultNonretryableError = {
  /**
   * - **error**: Indicates that we got a non-retryable error like a 422
   */
  type: 'error';
  data: undefined;
  error: ReactElement;
  retryAt: undefined;
};
type ResultRetryableError = {
  /**
   * - **errorRetryable**: Indicates that we got a retryable error like a 503 or we got a
   *   Retry-After header
   */
  type: 'errorRetryable';
  data: undefined;
  error: ReactElement;
  /** When the error should be retried in local time */
  retryAt: Date;
};
export type Result<T extends object> =
  | ResultSuccess<T>
  | ResultReferenceIsExpired
  | ResultAuthError
  | ResultNonretryableError
  | ResultRetryableError;

type RequestInfo = {
  /** A unique string we use when logging this request */
  uid: string;
  /** When this request started. In the case of retries, when the first attempt started. */
  startedAtOverall: Date;
  /** When this request started. In the case of retries, when this attempt started. */
  startedAtThisAttempt: Date;
  /** How many retryable errors there have been */
  retry: number;
};

type ActiveRequest<T extends object> = {
  /** Information about the active request */
  info: RequestInfo;
  /** The underlying cancelable */
  cancelable: CancelablePromise<Result<T>>;
  /**
   * As an intermediate state used for the state machine to avoid unpredictability
   * with task scheduling, when the cancelable finishes we push the result here
   * so it can be retrieved without scheduling any tasks
   */
  promiseResult?: { type: 'success'; result: Result<T> } | { type: 'error'; error: ReactElement };
};

type ActiveDataRequest<
  RefT extends object,
  DataT extends Requestable<RefT>
> = ActiveRequest<DataT> & {
  /** The reference we're using for this request */
  ref: RefT;
};

/**
 * Describes a reference to something which might be convertable to a
 * different object (typically, the actual data of the thing being referenced)
 * for some period of time (typically, until the JWT expires).
 *
 * This type doesn't actually do anything in the type system, but it's helpful
 * for reading the type hints to show the relationship between the reference
 * and the data
 */ /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
type Requestable<T extends object> = object;

type RefLatestInitial<RefT extends object> = {
  /**
   * - `initial`: Indicates this was the reference we were initialized with
   */
  type: 'initial';
  requestInfo: undefined;
  finishedAt: undefined;
  /** The initially provided reference, which might be null. */
  value: RefT | null;
  result: undefined;
};

type RefLatestFetched<RefT extends object> = {
  /**
   * - `fetched`: Indicates that this is the result of attempting to fetch the reference
   */
  type: 'fetched';
  /** Information about the attempt to fetch the reference */
  requestInfo: RequestInfo;
  /** When the request was completed, in local time */
  finishedAt: Date;
  value: undefined;
  /** The result of fetching the reference, which might have been unsuccessful */
  result: Result<RefT>;
};

type RefLatest<RefT extends object> = RefLatestInitial<RefT> | RefLatestFetched<RefT>;
type RefLatestSuccess<RefT extends object> =
  | (RefLatestInitial<RefT> & { value: RefT })
  | (RefLatestFetched<RefT> & { result: ResultSuccess<RefT> });

type RenewableRequestable<DataT extends object, RefT extends Requestable<DataT>> = {
  /** The latest reference */
  latest: RefLatest<RefT>;

  /** The active request for the reference, if there is one */
  activeRequest: ActiveRequest<RefT> | null;

  /**
   * Produces a cancelable promise to get a new reference to the thing being
   * downloaded. Note that not being able to fetch the reference due to
   * expiration is not retryable from the perspective of the caller
   * (RequestHandler).
   *
   * If, for example, this renewable requestable is for an image export which is
   * part of a playlist and has expiration, then fetching a new reference is a
   * matter of refetching the playlist to get a more up-to-date reference to the
   * image export. If that playlist reference is expired, then refetching the
   * playlist will require refetching the playlist reference from however _that_
   * was retrieved, which might have been part of a journey, to which its
   * reference might be expired, etc, etc.
   *
   * Often, this is implemented _not_ by directly fetching a reference, but
   * by instead via `reportExpired` on the request result of a different
   * RequestHandler, then waiting for the result to update!
   */
  fetchRef: () => CancelablePromise<Result<RefT>>;
};

/**
 * The internal representation of what we have fetched for a particular
 * determined reference. Note that a request() object can switch between
 * which internal data it's pointing to as it returns different references
 * from fetchRef.
 */
type InternalData<RefT extends object, DataT extends Requestable<RefT>> = {
  /** The uid of the reference this internal data is for */
  refUid: string;

  /** The internalUids that are holding locks on this data */
  locks: Set<string>;

  /**
   * The latest data that we have fetched from the server, or null if we
   * haven't completed any requests yet. This is what we're providing to
   * the RequestResult.
   */
  latest: {
    /** Information about the request that was made */
    requestInfo: RequestInfo;

    /** When the request was completed */
    finishedAt: Date;

    /**
     * The final result before either the error was non-retryable or
     * we hit the quick retry limit
     */
    data: Result<DataT>;
  } | null;

  /**
   * The active request, if any, that is currently being processed.
   */
  activeRequest: ActiveDataRequest<RefT, DataT> | null;
};

type RequestResultSuccess<T extends object> = {
  /** Indicates the data was fetched successfully and is still unexpired */
  type: 'success';
  /** The underlying data that was fetched */
  data: T;
  error: undefined;
  /** Can be called to indicate that this data is expired and needs to be refetched */
  reportExpired: () => void;
};

type RequestResultLoading = {
  /** Indicates that we are actively fetching the data (or the ref) */
  type: 'loading';
  data: undefined;
  error: undefined;
};

type RequestResultError = {
  /** Indicates that we failed to fetch the data and are no longer trying */
  type: 'error';
  data: undefined;
  /** Describes what went wrong */
  error: ReactElement;
};

type RequestResultReleased = {
  /** Indicates that the request has been released */
  type: 'released';
  data: undefined;
  error: undefined;
};

export type RequestResultConcrete<DataT extends object> =
  | RequestResultSuccess<DataT>
  | RequestResultLoading
  | RequestResultError
  | RequestResultReleased;

const concreteResultEqualityFn = <DataT extends object>(
  a: RequestResultConcrete<DataT>,
  b: RequestResultConcrete<DataT>
): boolean => a.type === b.type && a.data === b.data && a.error === b.error;

export type RequestResult<DataT extends object> = {
  /** The current result of the request */
  data: ValueWithCallbacks<RequestResultConcrete<DataT>>;

  /** Releases the request if it hasn't been released already. */
  release: () => void;
};

type WritableRequestResult<DataT extends object> = {
  /** The current result of the request */
  data: WritableValueWithCallbacks<RequestResultConcrete<DataT>>;

  /** Releases the request if it hasn't been released already. */
  release: () => void;
};

type RequestHandlerLogConfig = {
  /**
   * How to handle logging:
   * - `buffer`: we store logged requests in memory, and they can be emitted by calling `flushLogs`
   * - `direct`: we log directly to the console
   * - `none`: we don't log anything (default)
   */
  readonly logging: 'buffer' | 'direct' | 'none';

  /** The maximum number of buffered lines for logging type `buffer`. Default 1000 */
  readonly maxBufferedLines?: number;

  /** The maximum number of buffered characters for logging type `buffer`. Default 10,000 */
  readonly maxBufferedCharacters?: number;
};

type RequestHandlerCacheConfig = {
  /** The maximum number of stale items to keep around in a least-recently-used fashion */
  maxStale: number;

  /**
   * Determines when active requests for data that is no longer necessary are canceled.
   *
   * If true, we cancel active requests upon being evicted from the stale cache
   * If false, we cancel active requests upon entering the stale cache
   */
  keepActiveRequestsIntoStale: boolean;
};

type RequestHandlerRetryConfig = {
  /** The maximum number of retries before giving up on retryable errors */
  maxRetries: number;
};
/**
 * Describes what we are internally tracking for a single call to request()
 */
type Internal<DataT extends object, RefT extends Requestable<DataT>> = {
  /** A stable uid we assigned to this request */
  internalUid: string;

  /**
   * The reference to the thing being downloaded, which we might need to fetch.
   */
  ref: RenewableRequestable<DataT, RefT>;

  /**
   * What we returned to the caller from the initial request()
   */
  result: WritableRequestResult<DataT>;
};

type InternalWithRef<DataT extends object, RefT extends Requestable<DataT>> = Internal<
  DataT,
  RefT
> & {
  ref: { latest: RefLatestSuccess<RefT> };
};

/**
 * A generic request handler for something which can be described either by a reference
 * (typically, uid + jwt) or by the actual data itself. Since the reference usually
 * contains a JWT, it can expire, which means it can't be used to fetch the data anymore.
 * The caller can tell us about expired references by returning `ResultReferenceIsExpired`
 * from `getDataFromRef`. This lazy approach is efficient: we don't need to eagerly refresh
 * references that we might not even use again.
 *
 * Similarly, for data, it being expired is only important if a downstream user
 * needs it to be active. For example, a stale reference to an image export
 * might be fine if we already have the image export on disk. Hence, we need to
 * be informed of expired data via the reportExpired callback on a RequestResult
 *
 * For some operations we may not need to be able to actually fetch data, only determine
 * the uid for the reference. To avoid the need to pass malformed objects to these if only
 * that information is available (e.g., `{"uid": uid, "jwt": ""}`) or going around the
 * type system, RefTForUID is allowed to be a subset of RefT which is accepted if we will
 * not attempt to call getDataFromRef directly on the value.
 */
export class RequestHandler<
  RefTForUID extends object,
  RefT extends RefTForUID,
  DataT extends object
> {
  /** Extracts the uid from a given reference */
  private readonly getRefUid: (ref: RefTForUID) => string;
  /**
   * Converts a reference to the corresponding data. Should reject with
   * `new Error('canceled')` on cancellation
   */
  private readonly getDataFromRef: (ref: RefT) => CancelablePromise<Result<DataT>>;
  /**
   * Given two refs with the same uid, return -1 if we should assume a is newer,
   * 0 if they are the same age, and 1 if b is newer.
   *
   * We rely on definitely newer refs being compared lower to prevent cycles;
   * it is sufficient to just use a basic counter strategy if timestamps are
   * not available on the refs (or ensuring you never return `expired` or `forbidden`
   * from `getDataFromRef`)
   */
  private readonly compareRefs: (a: RefT, b: RefT) => number;
  /**
   * Should be called to dispose of any resources associated with the given
   * data when it is no longer needed.
   */
  private readonly cleanupData: (data: DataT) => void;
  /** How logging is configured */
  private readonly logConfig: RequestHandlerLogConfig;
  /** How retries are configured */
  private readonly retryConfig: RequestHandlerRetryConfig;
  /**
   * If true, any requests we start we don't cancel unless they don't complete
   * by the time they are bumped from the stale list. If false, we cancel any
   * requests we start if they don't complete by the time all locks on them are
   * released (i.e., they enter the stale list).
   */
  private readonly keepActiveRequestsIntoStale: boolean;

  /**
   * All the requests that we are currently tracking, keyed by the internalUid
   * generated at the beginning of the corresponding request().
   *
   * This can be used to determine the latest ref uid, which can then be used to
   * go to the data in determinedByRefUid.
   */
  private readonly requestsByInternalUid: Map<string, Internal<DataT, RefT>>;

  /**
   * All the locked data we have, keyed by the refUid that was used to fetch it
   */
  private readonly lockedDataByRefUid: Map<string, InternalData<RefT, DataT>>;

  /** All the stale data we have, keyed by the refUid that was used to fetch it */
  private staleDataByRefUid: LeastRecentlyUsedCache<string, InternalData<RefT, DataT>>;

  /** If logging is configured to buffer until requested, the current buffer, otherwise null. */
  private readonly logBuffer: {
    buffer: string[];
    droppedLines: number;
    droppedCharacters: number;
    sumCharacters: number;
    maxLines: number;
    maxCharacters: number;
  } | null;

  private readonly logStack: string[] = [];

  constructor({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig,
    cacheConfig,
    retryConfig,
    cleanupData,
  }: {
    getRefUid: (ref: RefTForUID) => string;
    getDataFromRef: (ref: RefT) => CancelablePromise<Result<DataT>>;
    compareRefs: (a: RefT, b: RefT) => number;
    logConfig: RequestHandlerLogConfig;
    cacheConfig: RequestHandlerCacheConfig;
    retryConfig: RequestHandlerRetryConfig;
    cleanupData?: (data: DataT) => void;
  }) {
    this.getRefUid = getRefUid;
    this.getDataFromRef = getDataFromRef;
    this.compareRefs = compareRefs;
    this.cleanupData = cleanupData ?? (() => {});
    this.logConfig = logConfig;
    this.retryConfig = retryConfig;
    this.requestsByInternalUid = new Map();
    this.lockedDataByRefUid = new Map();
    this.staleDataByRefUid = new LeastRecentlyUsedCache(cacheConfig.maxStale);
    this.keepActiveRequestsIntoStale = cacheConfig.keepActiveRequestsIntoStale;
    this.logBuffer =
      logConfig.logging === 'buffer'
        ? {
            buffer: [],
            droppedLines: 0,
            droppedCharacters: 0,
            sumCharacters: 0,
            maxLines: logConfig.maxBufferedLines ?? 1000,
            maxCharacters: logConfig.maxBufferedCharacters ?? 10000,
          }
        : null;

    this.log = this.logConfig.logging === 'none' ? () => {} : this.log.bind(this);
    this.logNest = this.logConfig.logging === 'none' ? () => {} : this.logNest.bind(this);
    this.logPop = this.logConfig.logging === 'none' ? () => {} : this.logPop.bind(this);
  }

  private log(rawMessage: string | (() => string)) {
    if (this.logConfig.logging === 'none') {
      return;
    }

    const message =
      this.logStack.join('.') + ': ' + (typeof rawMessage === 'string' ? rawMessage : rawMessage());
    if (this.logConfig.logging === 'direct') {
      console.log(message);
      return;
    }

    if (this.logBuffer === null) {
      throw new Error('logBuffer should not be null if logging is set to buffer');
    }
    const bfr = this.logBuffer;

    bfr.buffer.push(message);
    bfr.sumCharacters += message.length;

    while (bfr.buffer.length > bfr.maxLines || bfr.sumCharacters > bfr.maxCharacters) {
      const removed = bfr.buffer.shift()!;
      bfr.droppedLines++;
      bfr.droppedCharacters += removed.length;
      bfr.sumCharacters -= removed.length;
    }
  }

  private logNest(...identifiers: string[]) {
    this.logStack.push(identifiers.join('.'));
  }

  private logPop(n: number = 1) {
    for (let i = 0; i < n; i++) {
      this.logStack.pop();
    }
  }

  /**
   * Flushes logs to the console, if logging is configured to buffer, otherwise
   * does nothing
   */
  flushLogs() {
    if (this.logBuffer === null) {
      return;
    }

    for (const line of this.logBuffer.buffer) {
      console.log(line);
    }
    this.logBuffer.buffer.length = 0;
    this.logBuffer.droppedLines = 0;
    this.logBuffer.droppedCharacters = 0;
    this.logBuffer.sumCharacters = 0;
  }

  /**
   * Releases the currently held lock by the internal request with the given
   * uid on the given ref.
   */
  private releaseLock(internalUid: string, ref: RefT) {
    const refUid = this.getRefUid(ref);
    this.logNest('releaseLock', internalUid, refUid);
    try {
      this.log('called');
      const data = this.lockedDataByRefUid.get(refUid);
      if (data === undefined) {
        this.log('WARNING! no data to release');
        return;
      }

      if (!data.locks.delete(internalUid)) {
        this.log('WARNING! lock was not held');
        return;
      }
      this.log('released lock');

      if (data.locks.size > 0) {
        this.log('still have other locks on data, so progressing released data');
        this.progressData(refUid);
        return;
      }

      this.log(`moving to stale`);
      if (data.activeRequest !== null) {
        if (this.keepActiveRequestsIntoStale) {
          this.log('has an active request which allowing to continue');
        } else {
          this.log('canceling active data request');
          data.activeRequest.cancelable.cancel();
          data.activeRequest = null;
        }
      }

      if (!this.lockedDataByRefUid.delete(refUid)) {
        throw new Error('integrity error: changed while releasing lock');
      }
      const evicted = this.staleDataByRefUid.add(refUid, data);
      if (evicted !== null) {
        const [evictedRefUid, evictedData] = evicted;
        if (evictedRefUid === refUid) {
          throw new Error('integrity error: already in stale');
        }

        this.log(
          () =>
            `evicted ${evictedRefUid} from stale; has an active request? ${
              evictedData.activeRequest !== null
            }`
        );
        if (evictedData.activeRequest !== null) {
          this.log(
            `canceling active request during eviction from stale; expected to be possible? ${this.keepActiveRequestsIntoStale}`
          );
          evictedData.activeRequest.cancelable.cancel();
          evictedData.activeRequest = null;
        }
        if (evictedData.latest !== null && evictedData.latest.data.type === 'success') {
          this.log('cleaning up evicted data');
          this.cleanupData(evictedData.latest.data.data);
        }
      }
    } finally {
      this.logPop();
    }
  }

  /**
   * Like releaseLock, except this takes the current `latest` ref of the internal
   * request with the given uid as the ref to release. If there is no latest
   * ref available, this does nothing.
   */
  private releaseLatestLock(internalUid: string) {
    this.logNest('releaseLatestLock', internalUid);
    try {
      const internal = this.requestsByInternalUid.get(internalUid);
      if (internal === undefined) {
        this.log(`WARNING! unknown internal request: ${internalUid}`);
        return;
      }

      if (internal.ref.latest.type === 'initial') {
        if (internal.ref.latest.value !== null) {
          this.releaseLock(internalUid, internal.ref.latest.value);
        } else {
          this.log('no latest ref available (initial & null)');
        }
      } else if (internal.ref.latest.result.type === 'success') {
        this.releaseLock(internalUid, internal.ref.latest.result.data);
      } else {
        this.log('no latest ref available (fetched & not success)');
      }
    } finally {
      this.logPop();
    }
  }

  /**
   * Releases the internal request with the given internalUid, if it exists.
   */
  private release(internalUid: string) {
    this.logNest('release', internalUid);
    try {
      this.log('called');

      const internal = this.requestsByInternalUid.get(internalUid);
      if (internal === undefined) {
        this.log('already released');
        return;
      }

      if (internal.ref.activeRequest !== null) {
        this.log('canceling active ref request');
        internal.ref.activeRequest.cancelable.cancel();
        internal.ref.activeRequest = null;
      }

      this.releaseLatestLock(internalUid);
      this.requestsByInternalUid.delete(internalUid);
      internal.result.data.set({
        type: 'released',
        data: undefined,
        error: undefined,
      });
      internal.result.data.callbacks.call(undefined);
    } finally {
      this.logPop();
    }
  }

  /**
   * Ensures the `refUid` is a key in lockedDataByRefUid either by verification,
   * restoring it from cache, or initializing it.
   *
   * Once its in the data list, locks with the given `internalUid`.
   */
  private ensureAndLock(refUid: string, internalUid: string): InternalData<RefT, DataT> {
    this.logNest('ensureAndLock', refUid, internalUid);
    try {
      this.log('called');

      const live = this.lockedDataByRefUid.get(refUid);
      if (live !== undefined) {
        this.log('in live list already, locking');
        live.locks.add(internalUid);
        return live;
      }

      const cached = this.staleDataByRefUid.get(refUid, undefined, true);
      if (cached !== undefined) {
        this.log(
          () =>
            `in cached, resurrecting. latest is null: ${
              cached.latest === null
            }; latest data type: ${cached.latest?.data.type}. active request is null? ${
              cached.activeRequest === null
            }`
        );
        this.staleDataByRefUid.remove(refUid);
        if (cached.locks.size !== 0) {
          this.log('WARNING! locks on cached data');
        }
        cached.locks.add(internalUid);
        this.lockedDataByRefUid.set(refUid, cached);

        if (cached.activeRequest !== null) {
          this.log('attaching listeners to resurrected active data request');
          this.addDataPromiseHandlers(refUid, cached.activeRequest);
        }

        return cached;
      }

      this.log('not in live or cached, initializing with no latest or active request');
      const data: InternalData<RefT, DataT> = {
        refUid,
        locks: new Set([internalUid]),
        latest: null,
        activeRequest: null,
      };
      this.lockedDataByRefUid.set(refUid, data);
      return data;
    } finally {
      this.logPop();
    }
  }

  /**
   * Updates the promiseResult on the given active request then
   * progresses the internal request with the given uid once the
   * corresponding cancelable promise settles (resolves or rejects).
   */
  private addRefPromiseHandlers(internalUid: string, req: ActiveRequest<RefT>) {
    req.cancelable.promise.then(
      (value) => {
        // We could be either a microtask or a task later; for consistency,
        // lets always be at least a task later
        setTimeout(() => {
          this.logNest('refPromiseThen');
          try {
            const latestRequest = this.requestsByInternalUid.get(internalUid);
            if (latestRequest === undefined || !Object.is(latestRequest.ref.activeRequest, req)) {
              this.log('no longer the active request, ignoring');
            } else {
              req.promiseResult = { type: 'success', result: value };
              this.progress(internalUid);
            }
          } finally {
            this.logPop();
          }
        });
      },
      (errorRaw) => {
        // We could be either a microtask or a task later; for consistency,
        // lets always be at least a task later
        setTimeout(() => {
          // we check before describeError to avoid its side effects
          {
            const latestRequest = this.requestsByInternalUid.get(internalUid);
            if (latestRequest === undefined || !Object.is(latestRequest.ref.activeRequest, req)) {
              this.logNest('refPromiseCatch');
              this.log('no longer the active request, ignoring');
              this.logPop();
              return;
            }
          }

          describeError(errorRaw).then((error) => {
            this.logNest('refPromiseCatch');
            try {
              const latestRequest = this.requestsByInternalUid.get(internalUid);
              if (latestRequest === undefined || !Object.is(latestRequest.ref.activeRequest, req)) {
                this.log('no longer the active request, ignoring');
                return;
              }

              req.promiseResult = { type: 'error', error };
              this.progress(internalUid);
            } finally {
              this.logPop();
            }
          });
        });
      }
    );
  }

  /**
   * Initializes the active request for the internal request with the given uid.
   */
  private initRefRequest(internalUid: string) {
    this.logNest('initRefRequest', internalUid);
    try {
      this.log('called');
      const internal = this.requestsByInternalUid.get(internalUid);
      if (internal === undefined) {
        this.log('WARNING! unknown internal request');
        return;
      }

      if (internal.ref.activeRequest !== null) {
        this.log('WARNING! active request already exists');
        return;
      }

      const now = new Date();
      const req: ActiveRequest<RefT> = {
        info: {
          uid: 'oseh_client_rqrefreq_' + createUID(),
          startedAtOverall: now,
          startedAtThisAttempt: now,
          retry: 0,
        },
        cancelable: internal.ref.fetchRef(),
      };
      internal.ref.activeRequest = req;
      this.addRefPromiseHandlers(internalUid, req);
    } finally {
      this.logPop();
    }
  }

  /**
   * Updates the `result` for all the internal requests with locks on the given
   * data with the given value.
   */
  private notifyLockHolders(
    data: InternalData<RefT, DataT>,
    newData: RequestResultConcrete<DataT>
  ) {
    this.logNest('notifyLockHolders');
    try {
      this.log(() => `called with type ${newData.type}`);
      const iter = data.locks.values();
      let next = iter.next();
      let numNotified = 0;
      let numNotifySkip = 0;
      while (!next.done) {
        const internalUid = next.value;
        const internal = this.requestsByInternalUid.get(internalUid);
        if (internal === undefined) {
          this.log(`WARNING! bad internal uid within locks: ${internalUid} (already released?)`);
          next = iter.next();
          continue;
        }
        if (!concreteResultEqualityFn(internal.result.data.get(), newData)) {
          numNotified++;
          internal.result.data.set(newData);
          internal.result.data.callbacks.call(undefined);
        } else {
          numNotifySkip++;
        }
        next = iter.next();
      }
      this.log(() => `notified ${numNotified} lock holders (${numNotifySkip} skipped)`);
    } finally {
      this.logPop();
    }
  }

  /**
   * Finds the best ref for the given uid, if the refUid is a key to the
   * lockedDataByRefUid map and at least one of the lock holders has a
   * successful latest data (they all should).
   */
  private findBestRefHolder(refUid: string): InternalWithRef<DataT, RefT> | null {
    this.logNest('findBestRefHolder', refUid);
    try {
      const data = this.lockedDataByRefUid.get(refUid);
      if (data === undefined) {
        this.log('WARNING! no data available');
        return null;
      }

      const log = this.log;
      const compare = this.compareRefs;

      let best: InternalWithRef<DataT, RefT> | null = null;
      let bestRef: RefT | null = null;
      const iter = data.locks.values();
      let next = iter.next();
      while (!next.done) {
        const internalUid = next.value;
        const internal = this.requestsByInternalUid.get(internalUid);
        if (internal === undefined) {
          log(`WARNING! locks contain bad internal uid: ${internalUid} (already released?)`);
          next = iter.next();
          continue;
        }

        const ref = internal.ref.latest.value ?? internal.ref.latest.result?.data;
        if (ref === undefined) {
          log(`WARNING! locks contain internal with no ref: ${internalUid}`);
          next = iter.next();
          continue;
        }

        if (bestRef === null || compare(ref, bestRef) < 0) {
          log(() => `found new best ref via ${internalUid}`);
          best = internal as InternalWithRef<DataT, RefT>;
          bestRef = ref;
        }
        next = iter.next();
      }
      if (best === null) {
        log('WARNING! no best ref found');
      }
      return best;
    } finally {
      this.logPop();
    }
  }

  /**
   * Updates the promiseResult on the given active request then
   * progresses the data with the given ref uid once the
   * corresponding cancelable promise settles (resolves or rejects).
   */
  private addDataPromiseHandlers(refUid: string, req: ActiveRequest<DataT>) {
    req.cancelable.promise.then(
      (value) => {
        // We could be either a microtask or a task later; for consistency,
        // lets always be at least a task later
        setTimeout(() => {
          this.logNest('dataPromiseThen');

          try {
            const lockedData = this.lockedDataByRefUid.get(refUid);
            if (lockedData === undefined || !Object.is(lockedData.activeRequest, req)) {
              this.log('no longer the active request, ignoring');
            } else {
              req.promiseResult = { type: 'success', result: value };
              this.progressData(refUid);
            }
          } finally {
            this.logPop();
          }
        });
      },
      (errorRaw) => {
        // We could be either a microtask or a task later; for consistency,
        // lets always be at least a task later
        setTimeout(() => {
          const lockedData = this.lockedDataByRefUid.get(refUid);
          if (lockedData === undefined || !Object.is(lockedData.activeRequest, req)) {
            this.logNest('dataPromiseCatch');
            this.log('no longer the active request, ignoring');
            this.logPop();
            return;
          }

          describeError(errorRaw).then((error) => {
            this.logNest('dataPromiseCatch');
            try {
              const lockedData = this.lockedDataByRefUid.get(refUid);
              if (lockedData === undefined || !Object.is(lockedData.activeRequest, req)) {
                this.log('no longer the active request, ignoring');
              } else {
                req.promiseResult = { type: 'error', error };
                this.progressData(refUid);
              }
            } finally {
              this.logPop();
            }
          });
        });
      }
    );
  }

  /**
   * Handles a report that the data associated with the ref with the given uid is
   * expired by triggering a new active request (if its locked and there isn't one)
   */
  private reportExpired(refUid: string) {
    this.logNest('reportExpired', refUid);
    try {
      this.log('called');

      const data = this.lockedDataByRefUid.get(refUid);
      if (data === undefined) {
        this.log('WARNING! reportExpired on data that is not locked (probably a caller issue)');
        return;
      }

      if (data.activeRequest !== null) {
        this.log('active request already exists, nothing to do');
        return;
      }

      const oldLatest = data.latest;
      data.latest = null;
      this.notifyLockHolders(data, {
        type: 'loading',
        data: undefined,
        error: undefined,
      });
      this.progressData(refUid);
      this.cleanupOldLatest(oldLatest?.data);
    } finally {
      this.log('done');
      this.logPop();
    }
  }

  /**
   * Initializes the activeRequest for the data associated with the given ref uid,
   * if its locked and doesn't already have one
   */
  private initDataRequest(refUid: string) {
    this.logNest('initDataRequest', refUid);
    try {
      this.log('called');
      const data = this.lockedDataByRefUid.get(refUid);
      if (data === undefined) {
        this.log('WARNING! no data available');
        return;
      }

      if (data.activeRequest !== null) {
        this.log('WARNING! active request already exists');
        return;
      }

      const bestRefHolder = this.findBestRefHolder(refUid);
      if (bestRefHolder === null) {
        this.log('WARNING! no ref available');
        return;
      }

      const bestRef =
        bestRefHolder.ref.latest.type === 'initial'
          ? bestRefHolder.ref.latest.value
          : bestRefHolder.ref.latest.result.data;

      const now = new Date();
      const req: ActiveDataRequest<RefT, DataT> = {
        info: {
          uid: 'oseh_client_rqdatareq_' + createUID(),
          startedAtOverall: now,
          startedAtThisAttempt: now,
          retry: 0,
        },
        ref: bestRef,
        cancelable: this.getDataFromRef(bestRef),
      };
      data.activeRequest = req;
      this.addDataPromiseHandlers(refUid, req);
    } finally {
      this.log('done');
      this.logPop();
    }
  }

  /**
   * Called after initializing data for a ref with the given uid or after
   * the active request for that ref has finished (and promiseResult was set).
   *
   * Starts an active request if necessary, or handles the result of the
   * active request if available, and updates the result for all the internal
   * requests which hold a lock on the data.
   *
   * Requires that the data has been locked.
   */
  private progressData(refUid: string) {
    this.logNest('progressData', refUid);
    try {
      const data = this.lockedDataByRefUid.get(refUid);
      if (data === undefined) {
        this.log('WARNING! no data available');
        return;
      }

      if (data.activeRequest !== null && data.activeRequest.promiseResult !== undefined) {
        this.log('handling result of active request');
        const finishedAt = new Date();
        const promiseResult = data.activeRequest.promiseResult;
        if (promiseResult.type === 'error') {
          this.log('active request failed (promise was rejected, not recoverable)');
          const res: Result<DataT> = {
            type: 'error',
            data: undefined,
            error: promiseResult.error,
            retryAt: undefined,
          };
          const oldLatest = data.latest;
          data.latest = {
            requestInfo: data.activeRequest.info,
            finishedAt,
            data: res,
          };
          data.activeRequest = null;
          this.notifyLockHolders(data, {
            type: 'error',
            data: undefined,
            error: res.error,
          });
          this.cleanupOldLatest(oldLatest?.data);
          return;
        }

        if (promiseResult.result.type === 'errorRetryable') {
          this.log('active request failed (retryable error result)');
          const oldRequestInfo = data.activeRequest.info;
          if (oldRequestInfo.retry >= this.retryConfig.maxRetries) {
            this.log('maximum retries exceeded, failing');
            const res: Result<DataT> = promiseResult.result;
            const oldLatest = data.latest;
            data.latest = {
              requestInfo: oldRequestInfo,
              finishedAt,
              data: res,
            };
            data.activeRequest = null;
            this.notifyLockHolders(data, {
              type: 'error',
              data: undefined,
              error: res.error,
            });
            this.cleanupOldLatest(oldLatest?.data);
            return;
          }

          this.log(`retryable at ${promiseResult.result.retryAt.toLocaleString()}`);

          const bestRefHolder = this.findBestRefHolder(refUid);
          if (bestRefHolder === null) {
            this.log('WARNING! without a ref available, treating as unrecoverable');
            const res: Result<DataT> = {
              type: 'error',
              data: undefined,
              error: promiseResult.result.error,
              retryAt: undefined,
            };
            const oldLatest = data.latest;
            data.latest = {
              requestInfo: oldRequestInfo,
              finishedAt,
              data: res,
            };
            data.activeRequest = null;
            this.notifyLockHolders(data, {
              type: 'error',
              data: undefined,
              error: res.error,
            });
            this.cleanupOldLatest(oldLatest?.data);
            return;
          }
          const bestRef =
            bestRefHolder.ref.latest.type === 'initial'
              ? bestRefHolder.ref.latest.value
              : bestRefHolder.ref.latest.result.data;

          this.log('queueing retry');
          data.activeRequest.info.retry++;
          data.activeRequest.promiseResult = undefined;
          data.activeRequest.info.startedAtThisAttempt = new Date();
          data.activeRequest.ref = bestRef;
          data.activeRequest.cancelable = delayCancelableUntil(
            () => this.getDataFromRef(bestRef),
            promiseResult.result.retryAt
          );
          this.addDataPromiseHandlers(refUid, data.activeRequest);
          return;
        }

        if (
          (promiseResult.result.type === 'expired' || promiseResult.result.type === 'forbidden') &&
          data.activeRequest.info.retry < this.retryConfig.maxRetries
        ) {
          this.log(
            `active request failed (${promiseResult.result.type}); but might be willing to retry`
          );
          const bestRefHolder = this.findBestRefHolder(refUid);
          if (bestRefHolder !== null) {
            const bestRef =
              bestRefHolder.ref.latest.type === 'initial'
                ? bestRefHolder.ref.latest.value
                : bestRefHolder.ref.latest.result.data;

            const comparison = this.compareRefs(bestRef, data.activeRequest.ref);
            if (comparison < 0) {
              this.log('retrying immediately with new ref');
              data.activeRequest.info.retry++;
              data.activeRequest.promiseResult = undefined;
              data.activeRequest.info.startedAtThisAttempt = new Date();
              data.activeRequest.ref = bestRef;
              data.activeRequest.cancelable = this.getDataFromRef(bestRef);
              this.addDataPromiseHandlers(refUid, data.activeRequest);
              return;
            } else if (
              bestRefHolder.ref.latest.type === 'initial' ||
              bestRefHolder.ref.latest.finishedAt.getTime() < Date.now() - 1000 * 60 * 5
            ) {
              this.log(
                `the best ref we have (${bestRefHolder.ref.latest.type} from ${bestRefHolder.internalUid}) could be stale; ` +
                  `checking if any of the refs are already actively fetching`
              );

              let refMightBeIncoming = false;
              {
                const iter = data.locks.values();
                let next = iter.next();
                while (!next.done) {
                  const internalUid = next.value;
                  const internal = this.requestsByInternalUid.get(internalUid);
                  if (internal === undefined) {
                    this.log(
                      `WARNING! bad internal uid within locks: ${internalUid} (already released?)`
                    );
                    next = iter.next();
                    continue;
                  }
                  if (internal.ref.activeRequest !== null) {
                    this.log(`internal ${internalUid} is actively fetching`);
                    refMightBeIncoming = true;
                    break;
                  }
                }
              }

              if (refMightBeIncoming) {
                this.log(
                  'since one of the lock holders might be fetching this ref already, not doing anything'
                );
                return;
              }

              // When this request succeeds or fails, even if it causes the bestRefHolders ref
              // to change, we will either be progressed or moved to stale (and will be progressed
              // when revived or reinitialized)
              this.initRefRequest(bestRefHolder.internalUid);
              return;
            } else {
              this.log(
                'since the best ref we have is fresh but not better than what we used, treating as unrecoverable'
              );
            }
          } else {
            this.log('WARNING! no best ref found, treating as unrecoverable');
          }
          const oldLatest = data.latest;
          data.latest = {
            requestInfo: data.activeRequest.info,
            finishedAt,
            data: promiseResult.result,
          };
          data.activeRequest = null;
          this.notifyLockHolders(data, {
            type: 'error',
            data: undefined,
            error: promiseResult.result.error,
          });
          this.cleanupOldLatest(oldLatest?.data);
          return;
        }

        if (promiseResult.result.type !== 'success') {
          this.log(
            `active request failed (non-retryable non-success: ${promiseResult.result.type})`
          );
          const res: Result<DataT> = promiseResult.result;
          const oldLatest = data.latest;
          data.latest = {
            requestInfo: data.activeRequest.info,
            finishedAt,
            data: res,
          };
          data.activeRequest = null;
          this.notifyLockHolders(data, {
            type: 'error',
            data: undefined,
            error: res.error,
          });
          this.cleanupOldLatest(oldLatest?.data);
          return;
        }

        this.log('active request succeeded, moving to latest');
        const oldLatest = data.latest;
        data.latest = {
          requestInfo: data.activeRequest.info,
          finishedAt,
          data: promiseResult.result,
        };
        data.activeRequest = null;

        const boundRefUid = refUid;
        this.notifyLockHolders(data, {
          type: 'success',
          data: promiseResult.result.data,
          error: undefined,
          reportExpired: () => this.reportExpired(boundRefUid),
        });
        this.cleanupOldLatest(oldLatest?.data);
        return;
      } // NEVER FALLTHROUGH

      if (
        data.latest !== null &&
        data.latest.data.type !== 'success' &&
        data.latest.finishedAt.getTime() < Date.now() - 1000 * 15
      ) {
        this.log('latest data is available, but its not success and old (>15s) - clearing it');
        data.latest = null;
      } // USING FALLTHROUGH

      if (data.latest === null) {
        if (data.activeRequest === null) {
          this.initDataRequest(refUid);
        }
        this.notifyLockHolders(data, {
          type: 'loading',
          data: undefined,
          error: undefined,
        });
        return;
      } // NEVER FALLTHROUGH

      if (data.latest.data.type === 'success') {
        this.notifyLockHolders(data, {
          type: 'success',
          data: data.latest.data.data,
          error: undefined,
          reportExpired: () => this.reportExpired(refUid),
        });
      } else {
        this.notifyLockHolders(data, {
          type: 'error',
          data: undefined,
          error: data.latest.data.error,
        });
      }
    } finally {
      this.log('done');
      this.logPop();
    }
  }

  /**
   * Called when replacing the latest value of data to ensure the old
   * value is cleaned up. This is intended to be called _after_ notifying lock
   * holders of the new value, to avoid temporarily having a disposed value
   * set
   */
  private cleanupOldLatest(oldLatest: Result<DataT> | null | undefined) {
    if (oldLatest !== null && oldLatest !== undefined && oldLatest.type === 'success') {
      this.log('cleaning up old latest data');
      this.cleanupData(oldLatest.data);
    }
  }

  /**
   * Called after an internal request with the given uid is initialized or
   * after its ref or data has been changed. It is required that before this
   * is called that the the request either has no locks, or it has an active
   * ref and it holds exactly one lock--on its latest ref.
   *
   * If the internal request has no latest ref, this will handle fetching it.
   * Otherwise, it will handle adding a lock on the new data (if necessary)
   * and making sure that data is progressing.
   *
   * This will also handle matching the result for that internal request to
   * the current state.
   */
  private progress(internalUid: string) {
    this.logNest('progress', internalUid);
    try {
      this.log('called');

      const internal = this.requestsByInternalUid.get(internalUid);
      if (internal === undefined) {
        this.log('WARNING! unknown request (already released?)');
        return;
      }

      if (
        internal.ref.activeRequest !== null &&
        internal.ref.activeRequest.promiseResult !== undefined
      ) {
        const res = internal.ref.activeRequest.promiseResult;
        const finishedAt = new Date();
        if (res.type === 'error') {
          this.log('active request for the ref failed (promise was rejected, not recoverable)');
          this.releaseLatestLock(internalUid);
          internal.ref.latest = {
            type: 'fetched',
            requestInfo: internal.ref.activeRequest.info,
            finishedAt,
            value: undefined,
            result: {
              type: 'error',
              data: undefined,
              error: res.error,
              retryAt: undefined,
            },
          };
          internal.ref.activeRequest = null;
          internal.result.data.set({
            type: 'error',
            data: undefined,
            error: res.error,
          });
          internal.result.data.callbacks.call(undefined);
          return;
        }

        if (res.result.type === 'errorRetryable') {
          this.log('active request for the ref failed (retryable error result)');
          const oldRequestInfo = internal.ref.activeRequest.info;

          if (oldRequestInfo.retry >= this.retryConfig.maxRetries) {
            this.log('maximum retries exceeded, failing');
            this.releaseLatestLock(internalUid);
            internal.ref.latest = {
              type: 'fetched',
              requestInfo: oldRequestInfo,
              finishedAt,
              value: undefined,
              result: res.result,
            };
            internal.ref.activeRequest = null;
            internal.result.data.set({
              type: 'error',
              data: undefined,
              error: res.result.error,
            });
            internal.result.data.callbacks.call(undefined);
            return;
          }

          this.log(`retrying at ${res.result.retryAt.toLocaleString()}`);
          internal.ref.activeRequest.info.retry++;
          internal.ref.activeRequest.promiseResult = undefined;
          internal.ref.activeRequest.info.startedAtThisAttempt = new Date();
          internal.ref.activeRequest.cancelable = delayCancelableUntil(
            internal.ref.fetchRef,
            res.result.retryAt
          );
          this.addRefPromiseHandlers(internalUid, internal.ref.activeRequest);
          return;
        }

        if (res.result.type !== 'success') {
          this.log(
            `active request for the ref failed (non-retryable non-success: ${res.result.type})`
          );
          this.releaseLatestLock(internalUid);
          internal.ref.latest = {
            type: 'fetched',
            requestInfo: internal.ref.activeRequest.info,
            finishedAt,
            value: undefined,
            result: res.result,
          };
          internal.ref.activeRequest = null;
          internal.result.data.set({
            type: 'error',
            data: undefined,
            error: res.result.error,
          });
          internal.result.data.callbacks.call(undefined);
          return;
        }

        this.log('active request for the ref succeeded, moving to latest');
        const oldLatestRef = internal.ref.latest.value ?? internal.ref.latest.result?.data;
        if (
          oldLatestRef !== undefined &&
          this.getRefUid(oldLatestRef) !== this.getRefUid(res.result.data)
        ) {
          this.releaseLatestLock(internalUid);
        }
        internal.ref.latest = {
          type: 'fetched',
          requestInfo: internal.ref.activeRequest.info,
          finishedAt,
          value: undefined,
          result: res.result,
        };
        internal.ref.activeRequest = null;
      } // USING FALLTHROUGH

      const ref = internal.ref.latest.value ?? internal.ref.latest.result?.data;
      if (ref === undefined) {
        if (internal.ref.activeRequest === null) {
          this.initRefRequest(internalUid);
        }
        return;
      }
      const refUid = this.getRefUid(ref);
      this.ensureAndLock(refUid, internalUid);
      this.progressData(refUid);
    } finally {
      this.log('done');
      this.logPop();
    }
  }

  /**
   * The primary interface to this class. Given a reference to the thing you
   * want to download, returns the downloaded thing as a value with callbacks.
   *
   * Where this is particularly powerful but also potentially confusing is that
   * if your reference is expired when we go to fetch the data as reported by
   * the `getDataFromRef` on this `RequestHandler`, we will use the provided
   * `refreshRef` to get a new reference to the thing being downloaded. This may
   * result in you deciding you actually wanted to download something else For
   * example, you are requesting the image playlist for the background image of
   * a journey, and the playlist image within the journey is expired, so you
   * refetch the journey, but now the journey has a new background image.
   *
   * This function can handle that scenario seamlessly, without you needing to
   * release() the old request and request() the new one, as a naive
   * implementation of that would lead to either redownloading resources
   * unnecessarily or insufficient error handling.
   */
  request({
    ref,
    refreshRef,
  }: {
    ref: RefT | null;
    refreshRef: () => CancelablePromise<Result<RefT>>;
  }): RequestResult<DataT> {
    const log = this.log;
    const internalUid = 'oseh_client_rhint_' + createUID();

    this.logNest('request', internalUid);
    try {
      const data = createWritableValueWithCallbacks<RequestResultConcrete<DataT>>({
        type: 'loading',
        data: undefined,
        error: undefined,
      });

      const result: WritableRequestResult<DataT> = {
        data,
        release: this.release.bind(this, internalUid),
      };

      if (ref === null) {
        log(`no initial ref`);
      } else {
        log(`initial ref: ${this.getRefUid(ref)}`);
      }

      this.requestsByInternalUid.set(internalUid, {
        internalUid,
        ref: {
          latest: {
            type: 'initial',
            requestInfo: undefined,
            finishedAt: undefined,
            value: ref,
            result: undefined,
          },
          activeRequest: null,
          fetchRef: refreshRef,
        },
        result,
      });
      this.progress(internalUid);
      return result;
    } finally {
      this.logPop();
    }
  }

  /**
   * Given a reference to something, this will ensure that either we do not have
   * any values corresponding to that ref, or how to handle it if we do.
   *
   * If the data for the given ref is in the stale list, it is removed from it.
   *
   * If the data for the given ref is in the active list, meaning there is an active
   * request for it:
   * - if we are getting the data to that ref, that is canceled
   * - we use the data() function to potentially synchronously get the new data. If
   *   it returns `{ type: 'make-request' }`, then we start a new active request
   *   instead.
   */
  evictOrReplace(
    ref: RefTForUID,
    data?: (
      old: DataT | undefined
    ) => { type: 'data'; data: DataT } | { type: 'make-request'; data: undefined }
  ) {
    const refUid = this.getRefUid(ref);
    this.logNest('evictOrReplace', refUid);
    try {
      const stale = this.staleDataByRefUid.get(refUid);
      if (stale !== undefined) {
        this.log('found in stale list, removing and done.');
        this.staleDataByRefUid.remove(refUid);
        if (stale.activeRequest !== null) {
          stale.activeRequest.cancelable.cancel();
          stale.activeRequest = null;
        }
        return;
      }

      const locked = this.lockedDataByRefUid.get(refUid);
      if (locked === undefined) {
        this.log('not in stale or locked; nothing to do');
        return;
      }

      this.log('found in locked');
      if (locked.activeRequest !== null) {
        this.log('active request exists, canceling');
        const active = locked.activeRequest;
        locked.activeRequest = null;
        active.cancelable.cancel();
      }

      const oldData =
        locked.latest !== null && locked.latest.data.type === 'success'
          ? locked.latest.data.data
          : undefined;
      const newData =
        data === undefined ? { type: 'make-request' as const, data: undefined } : data(oldData);
      if (newData.type === 'data') {
        this.log('synchronous data update available, updating and notifying lock holders');
        const now = new Date();
        const oldLatest = locked.latest;
        locked.latest = {
          requestInfo: {
            uid: 'oseh_client_rqdatareq_' + createUID(),
            startedAtOverall: now,
            startedAtThisAttempt: now,
            retry: 0,
          },
          finishedAt: now,
          data: {
            type: 'success',
            data: newData.data,
            error: undefined,
            retryAt: undefined,
          },
        };
        this.notifyLockHolders(locked, {
          type: 'success',
          data: newData.data,
          error: undefined,
          reportExpired: () => this.reportExpired(refUid),
        });
        this.cleanupOldLatest(oldLatest?.data);
        return;
      }

      this.log('no synchronous data update available, resetting and progressing');
      const oldLatest = locked.latest;
      locked.latest = null;
      this.progressData(refUid);
      this.cleanupOldLatest(oldLatest?.data);
    } finally {
      this.logPop();
    }
  }
}

/**
 * Wraps the given cancelable promise so that the underlying cancelable will
 * not be queued until the given date.
 */
function delayCancelableUntil<T>(
  cancelable: () => CancelablePromise<T>,
  until: Date
): CancelablePromise<T> {
  return constructCancelablePromise({
    body: async (state, resolve, reject) => {
      if (state.finishing) {
        state.done = true;
        reject(new Error('canceled'));
        return;
      }

      const now = Date.now();
      const delayMs = until.getTime() - now;
      if (delayMs > 0) {
        const cancelableTimeout = createCancelableTimeout(delayMs);
        state.cancelers.add(cancelableTimeout.cancel);
        if (state.finishing) {
          cancelableTimeout.cancel();
        }
        try {
          await cancelableTimeout.promise;
        } catch (e) {
          state.finishing = true;
          state.done = true;
          reject(e);
        } finally {
          state.cancelers.remove(cancelableTimeout.cancel);
        }
        if (state.finishing) {
          state.done = true;
          reject(new Error('canceled'));
          return;
        }
      }

      try {
        const underlying = cancelable();
        state.cancelers.add(underlying.cancel);
        if (state.finishing) {
          underlying.cancel();
        }
        const res = await underlying.promise;
        state.finishing = true;
        state.done = true;
        resolve(res);
      } catch (e) {
        state.finishing = true;
        state.done = true;
        reject(e);
      }
    },
  });
}
