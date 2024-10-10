import { createWritableValueWithCallbacks, ValueWithCallbacks } from './Callbacks';
import { CancelablePromise } from './CancelablePromise';
import { constructCancelablePromise } from './CancelablePromiseConstructor';
import { createCancelableTimeout } from './createCancelableTimeout';
import { OrderedDictionary } from './OrderedDictionary';
import { setVWC } from './setVWC';
import { SortedList } from './SortedList';
import { waitForValueWithCallbacksConditionCancelable } from './waitForValueWithCallbacksCondition';
import { adaptCallbacksToAbortSignal } from './adaptCallbacksToAbortSignal';
import { apiFetch } from '../ApiConstants';

export type UploadPart = {
  /** the number of this part */
  number: number;
  /** the byte offset for the first byte, inclusive */
  startByte: number;
  /** the byte offset for the last byte, exclusive */
  endByte: number;
};

export type UploadPartRange = {
  /** the number of the first part in this range */
  number: number;
  /** the byte offset for the first byte within this range, inclusive */
  startByte: number;
  /** the number of parts in this range */
  numberOfParts: number;
  /** the number of bytes in each part in this range */
  partSize: number;
};

const autoCombiningInsert = (() => {
  const mergeRight = (arr: SortedList<UploadPartRange, number>, index: number) => {
    while (arr.list.length > index + 1) {
      if (
        arr.list[index].number + arr.list[index].numberOfParts === arr.list[index + 1].number &&
        arr.list[index].partSize === arr.list[index + 1].partSize
      ) {
        arr.list[index].numberOfParts += arr.list[index + 1].numberOfParts;
        arr.list.splice(index + 1, 1);
      } else {
        break;
      }
    }
  };

  const mergeLeft = (arr: SortedList<UploadPartRange, number>, index: number) => {
    while (index > 0) {
      if (
        arr.list[index].number === arr.list[index - 1].number + arr.list[index - 1].numberOfParts &&
        arr.list[index].partSize === arr.list[index - 1].partSize
      ) {
        arr.list[index - 1].numberOfParts += arr.list[index].numberOfParts;
        arr.list.splice(index, 1);
        index--;
      } else {
        break;
      }
    }
  };

  return (arr: SortedList<UploadPartRange, number>, part: UploadPartRange) => {
    if (arr.list.length === 0) {
      arr.list.push(part);
      return;
    }

    const insertIndex = arr.getSortedInsertionIndex(part.number);
    if (insertIndex >= arr.list.length) {
      arr.list.push(part);
      mergeLeft(arr, arr.list.length - 1);
      return;
    }

    if (insertIndex === 0) {
      arr.list.unshift(part);
      mergeRight(arr, 0);
      return;
    }

    arr.list.splice(insertIndex, 0, part);
    mergeRight(arr, insertIndex);
    mergeLeft(arr, insertIndex);
  };
})();

const shiftPartFromRangeSortedList = (
  arr: SortedList<UploadPartRange, number>
): UploadPart | undefined => {
  if (arr.list.length === 0) {
    return undefined;
  }

  const firstRange = arr.list[0];
  if (firstRange.numberOfParts === 1) {
    arr.list.shift();
    return {
      number: firstRange.number,
      startByte: firstRange.startByte,
      endByte: firstRange.startByte + firstRange.partSize,
    };
  }

  const firstPart: UploadPart = {
    number: firstRange.number,
    startByte: firstRange.startByte,
    endByte: firstRange.startByte + firstRange.partSize,
  };

  const newFirstRange: UploadPartRange = {
    number: firstRange.number + 1,
    startByte: firstRange.startByte + firstRange.partSize,
    numberOfParts: firstRange.numberOfParts - 1,
    partSize: firstRange.partSize,
  };
  arr.list[0] = newFirstRange;
  return firstPart;
};

const promotePartToRange = (part: UploadPart): UploadPartRange => ({
  number: part.number,
  startByte: part.startByte,
  numberOfParts: 1,
  partSize: part.endByte - part.startByte,
});

export type UploadPartStateAcquiringData = UploadPart & {
  /** The promise to get the data for this part */
  task: CancelablePromise<Blob>;
};

export type UploadPartStateUploading = UploadPart & {
  /** The data being uploaded */
  data: Blob;
  /** How many times this part has been attempted excluding this try (so starting at 0) */
  retryCounter: number;
  /** The current task to upload this part */
  task: CancelablePromise<TryUploadResult>;
};

export type UploadPartStateWaitingToRetry = UploadPart & {
  /** The data that is waiting to retry */
  data: Blob;
  /** The time in milliseconds since the epoch when this should be retried */
  retryAt: number;
  /** How many times this part has been attempted */
  retryCounter: number;
  /** The current task waiting for the retryAt time to be reached */
  task: CancelablePromise<void>;
};

export type UploadProgress = {
  /** The parts we've successfully uploaded, in ascending order by number */
  finished: ValueWithCallbacks<SortedList<UploadPartRange, number>>;
  /** The parts we've failed to upload and will not retry */
  errored: ValueWithCallbacks<SortedList<UploadPartRange, number>>;
  /** The parts that are in flight in one form or another */
  inprogress: {
    /** The parts that we are currently uploading, in ascending order by number */
    uploading: ValueWithCallbacks<SortedList<UploadPartStateUploading, number>>;
    /** The parts we are getting the data for, in ascending order by number */
    acquiringData: ValueWithCallbacks<SortedList<UploadPartStateAcquiringData, number>>;
    /** The parts that are waiting to be retried */
    waitingToRetry: ValueWithCallbacks<
      OrderedDictionary<UploadPartStateWaitingToRetry, 'number', 'retryAt'>
    >;
  };
  /** The parts that we have not started, in ascending order by number */
  remaining: ValueWithCallbacks<SortedList<UploadPartRange, number>>;
  /** some statistics about the number of retries required */
  retried: ValueWithCallbacks<{
    /** how many bytes have errored retryably so far */
    bytes: number;
    /** how many parts have errored retryably so far */
    parts: number;
    /** the number of times we have already attempted the part with the most attempts */
    highestCounter: number;
  }>;
};

export type TryUploadResultSuccess = {
  /**
   * - `success`: the part was uploaded successfully
   */
  type: 'success';
};

export type TryUploadResultRetryableError = {
  /**
   * - `retryable-error`: the part was not uploaded successfully, but
   *   we retrying might fix it
   */
  type: 'retryable-error';
  /**
   * The minimum amount of time until the next retry. The higher of this and
   * the retry backoff function determines the actual time to wait.
   */
  minRetryTimeMS: number;
};

export type TryUploadResultNonRetryableError = {
  /**
   * - `non-retryable-error`: the part was not uploaded successfully, and
   *   retrying will not fix it. You can also just reject the promise, which
   *   is handled the same way.
   */
  type: 'non-retryable-error';
};

export type TryUploadResult =
  | TryUploadResultSuccess
  | TryUploadResultRetryableError
  | TryUploadResultNonRetryableError;

export type UploadArgs = {
  /** The parts that will need to be uploaded */
  parts: UploadPartRange[];

  /** Configures how much concurrency is allowed */
  concurrency: {
    /** The maximum number of in-flight tasks to acquire data */
    acquireData: number;
    /** The maximum number of in-flight tasks to upload data */
    upload: number;
  };

  /** Configures how retrying parts works */
  retries: {
    /** The minimum backoff time in milliseconds after the attempt `retry` fails */
    backoff: (retry: number) => number;

    /** The maximum number of times to retry a part before giving up */
    max: number;
  };

  /**
   * The function to call to get the data associated with a part; usually just
   * uses Blob#slice which is synchronous, but fancier implementations are
   * expected for alternate upload implementations that don't know the size of
   * the file up front (e.g., streaming an audio file to the server).
   *
   * If the returned promise rejects, it is treated as a permanent failure for
   * the part.
   */
  getData: (part: UploadPart) => CancelablePromise<Blob>;

  /**
   * Uploads the given part. May reject for non-retryable errors, or
   * can resolve indicating whether the part was uploaded successfully
   * or not (and if it's retryable or not).
   *
   * @param part The part to try to upload
   * @returns The result of the attempt
   */
  tryUpload: (part: Omit<UploadPartStateUploading, 'task'>) => CancelablePromise<TryUploadResult>;
};

/** The result of using the standard upload function */
export type UploadResult = {
  /** Information about the progress so far */
  progress: UploadProgress;
  /** The state of the underlying coroutine managing the upload */
  state: ValueWithCallbacks<'running' | 'success' | 'error'>;
  /** Signals to the coroutine to cancel the upload as soon as possible */
  cancel: () => void;
};

/**
 * Manages the general loop for uploading something in parts. The actual part
 * to data and data to upload functions are injected, allowing this function
 * to be relatively pure (if you discount the state machine not completing
 * immediately upon returning)
 *
 * The maximum delay between cancellation and the upload stopping is the number
 * of event loop cycles equal to the maximum concurrency of acquiring data or
 * uploading data, whichever is higher.
 */
export const upload = ({
  parts,
  concurrency,
  retries,
  getData,
  tryUpload,
}: UploadArgs): UploadResult => {
  const finishedVWC = createWritableValueWithCallbacks<SortedList<UploadPartRange, number>>(
    new SortedList((v) => v.number)
  );
  const erroredVWC = createWritableValueWithCallbacks<SortedList<UploadPartRange, number>>(
    new SortedList((v) => v.number)
  );
  const uploadingVWC = createWritableValueWithCallbacks<
    SortedList<UploadPartStateUploading, number>
  >(new SortedList((v) => v.number));
  const acquiringDataVWC = createWritableValueWithCallbacks<
    SortedList<UploadPartStateAcquiringData, number>
  >(new SortedList((v) => v.number));
  const waitingToRetryVWC = createWritableValueWithCallbacks<
    OrderedDictionary<UploadPartStateWaitingToRetry, 'number', 'retryAt'>
  >(new OrderedDictionary('number', 'retryAt'));
  const remainingVWC = createWritableValueWithCallbacks<SortedList<UploadPartRange, number>>(
    (() => {
      const result = new SortedList<UploadPartRange, number>((v) => v.number);
      // assume probably in sorted or almost sorted order already
      for (const part of parts) {
        if (result.list.length === 0 || result.list[result.list.length - 1].number < part.number) {
          result.list.push(part);
        } else {
          result.sortedInsert(part);
        }
      }
      return result;
    })()
  );
  const retriedVWC = createWritableValueWithCallbacks({
    bytes: 0,
    parts: 0,
    highestCounter: 0,
  });
  const progress: UploadProgress = {
    finished: finishedVWC,
    errored: erroredVWC,
    inprogress: {
      uploading: uploadingVWC,
      acquiringData: acquiringDataVWC,
      waitingToRetry: waitingToRetryVWC,
    },
    remaining: remainingVWC,
    retried: retriedVWC,
  };
  const stateVWC = createWritableValueWithCallbacks<'running' | 'success' | 'error'>('running');
  const canceledVWC = createWritableValueWithCallbacks(false);

  // we currently never mutate the array references directly (prefering to
  // mutate the arrays) and in return can reduce the amount of indirection
  const finished = finishedVWC.get();
  const errored = erroredVWC.get();
  const uploading = uploadingVWC.get();
  const acquiringData = acquiringDataVWC.get();
  const waitingToRetry = waitingToRetryVWC.get();
  const remaining = remainingVWC.get();

  uploadOuter();

  return {
    progress,
    state: stateVWC,
    cancel: () => {
      setVWC(canceledVWC, true);
    },
  };

  function cancelEverythingAndSetError() {
    for (const part of uploading.list) {
      part.task.cancel();
      autoCombiningInsert(errored, promotePartToRange(part));
    }
    uploading.list.splice(0, uploading.list.length);
    for (const part of acquiringData.list) {
      part.task.cancel();
      autoCombiningInsert(errored, promotePartToRange(part));
    }
    acquiringData.list.splice(0, acquiringData.list.length);
    const iter = waitingToRetry.values();
    let next = iter.next();
    while (!next.done) {
      next.value.task.cancel();
      autoCombiningInsert(errored, promotePartToRange(next.value));
      next = iter.next();
    }
    waitingToRetry.clear();

    for (const part of remaining.list) {
      autoCombiningInsert(errored, part);
    }
    remaining.list.splice(0, remaining.list.length);

    stateVWC.set('error');

    uploadingVWC.callbacks.call(undefined);
    acquiringDataVWC.callbacks.call(undefined);
    waitingToRetryVWC.callbacks.call(undefined);
    remainingVWC.callbacks.call(undefined);
    erroredVWC.callbacks.call(undefined);
    stateVWC.callbacks.call(undefined);
  }

  function unreachable(v: never) {
    cancelEverythingAndSetError();
    throw new Error(`unreachable: ${v}`);
  }

  async function sweepUploading(): Promise<'continue' | 'errored'> {
    let i = 0;
    while (i < uploading.list.length) {
      if (!uploading.list[i].task.done()) {
        i++;
        continue;
      }

      const part = uploading.list.splice(i, 1)[0];
      let result: TryUploadResult;
      try {
        result = await part.task.promise;
      } catch (e) {
        console.log('sweepUploading error', e);
        result = { type: 'non-retryable-error' };
      }

      if (result.type === 'success') {
        autoCombiningInsert(finished, promotePartToRange(part));
        uploadingVWC.callbacks.call(undefined);
        finishedVWC.callbacks.call(undefined);
        continue;
      }

      if (result.type === 'retryable-error' && part.retryCounter < retries.max) {
        const retryTimeMS = Math.max(retries.backoff(part.retryCounter), result.minRetryTimeMS);
        const retryAt = Date.now() + retryTimeMS;
        const retryPart: UploadPartStateWaitingToRetry = {
          ...part,
          retryAt,
          retryCounter: part.retryCounter + 1,
          task: createCancelableTimeout(retryTimeMS),
        };
        waitingToRetry.insertSlow(retryPart, 'back');

        const oldRetried = retriedVWC.get();
        retriedVWC.set({
          bytes: oldRetried.bytes + part.endByte - part.startByte,
          parts: oldRetried.parts + 1,
          highestCounter: Math.max(oldRetried.highestCounter, retryPart.retryCounter),
        });

        uploadingVWC.callbacks.call(undefined);
        waitingToRetryVWC.callbacks.call(undefined);
        retriedVWC.callbacks.call(undefined);
        continue;
      }

      autoCombiningInsert(errored, promotePartToRange(part));
      return 'errored';
    }
    return 'continue';
  }

  async function sweepAcquiringData(): Promise<'continue' | 'need-upload-spot' | 'errored'> {
    let i = 0;
    while (i < acquiringData.list.length) {
      if (!acquiringData.list[i].task.done()) {
        i++;
        continue;
      }

      if (uploading.list.length >= concurrency.upload) {
        return 'need-upload-spot';
      }

      const part = acquiringData.list.splice(i, 1)[0];
      let data: Blob;
      try {
        data = await part.task.promise;
      } catch (e) {
        console.log('sweepAcquiringData error', e);
        autoCombiningInsert(errored, promotePartToRange(part));
        return 'errored';
      }

      const partialPart: Omit<UploadPartStateUploading, 'task'> = {
        number: part.number,
        startByte: part.startByte,
        endByte: part.endByte,
        retryCounter: 0,
        data,
      };
      const task = tryUpload(partialPart);

      const state: UploadPartStateUploading = {
        ...partialPart,
        task,
      };
      uploading.sortedInsert(state);
      uploadingVWC.callbacks.call(undefined);
      acquiringDataVWC.callbacks.call(undefined);
    }
    return 'continue';
  }

  async function sweepWaitingToRetry(): Promise<'continue' | 'need-upload-spot'> {
    while (true) {
      const peeked = waitingToRetry.peekHead();
      if (peeked === undefined || !peeked.task.done()) {
        return 'continue';
      }

      if (uploading.list.length >= concurrency.upload) {
        return 'need-upload-spot';
      }

      const part = waitingToRetry.shift();
      if (part === undefined) {
        throw new Error('peeked was not undefined, but shift returned undefined');
      }

      const cleanedPartialPart: Omit<UploadPartStateUploading, 'task'> = {
        number: part.number,
        startByte: part.startByte,
        endByte: part.endByte,
        retryCounter: part.retryCounter,
        data: part.data,
      };
      const task = tryUpload(cleanedPartialPart);
      const state: UploadPartStateUploading = {
        ...cleanedPartialPart,
        task,
      };
      uploading.sortedInsert(state);
      uploadingVWC.callbacks.call(undefined);
      waitingToRetryVWC.callbacks.call(undefined);
    }
  }

  async function sweepRemaining(): Promise<'all-queued' | 'need-acquire-data-spot'> {
    while (true) {
      if (remaining.list.length === 0) {
        return 'all-queued';
      }

      if (acquiringData.list.length >= concurrency.acquireData) {
        return 'need-acquire-data-spot';
      }

      const part = shiftPartFromRangeSortedList(remaining);
      if (part === undefined) {
        cancelEverythingAndSetError();
        throw new Error(
          'remaining.list.length was not 0, but shiftPartFromRangeSortedList returned undefined'
        );
      }

      const task = getData(part);
      const state: UploadPartStateAcquiringData = {
        ...part,
        task,
      };
      acquiringData.sortedInsert(state);
      acquiringDataVWC.callbacks.call(undefined);
      remainingVWC.callbacks.call(undefined);
    }
  }

  async function uploadInner() {
    const canceled = waitForValueWithCallbacksConditionCancelable(
      canceledVWC,
      (canceled) => canceled
    );
    canceled.promise.catch(() => {});

    try {
      while (true) {
        if (canceledVWC.get()) {
          cancelEverythingAndSetError();
          return;
        }

        // sweep uploading
        {
          const result = await sweepUploading();
          if (result === 'errored') {
            cancelEverythingAndSetError();
            return;
          }

          if (result !== 'continue') {
            unreachable(result);
          }
        }

        // sweep waiting to retry
        {
          const result = await sweepWaitingToRetry();
          if (result === 'need-upload-spot') {
            // don't bother acquiring data in advance when we are in retry
            // mode and need upload spots
            try {
              await Promise.race([canceled.promise, uploading.list.map((v) => v.task.promise)]);
            } catch {}
            continue;
          }

          if (result !== 'continue') {
            unreachable(result);
          }
        }

        // sweep acquiring data
        {
          const result = await sweepAcquiringData();
          if (result === 'errored') {
            cancelEverythingAndSetError();
            return;
          }

          if (result !== 'need-upload-spot' && result !== 'continue') {
            unreachable(result);
          }
        }

        // sweep remaining
        {
          const result = await sweepRemaining();
          if (result !== 'need-acquire-data-spot' && result !== 'all-queued') {
            unreachable(result);
          }

          if (uploading.list.length >= concurrency.upload) {
            try {
              await Promise.race([canceled.promise, ...uploading.list.map((v) => v.task.promise)]);
            } catch {}
            continue;
          }

          // fast case for synchronous getData implementations
          if (acquiringData.list.length > 0 && acquiringData.list[0].task.done()) {
            continue;
          }

          const retryHead = waitingToRetry.peekHead();
          if (
            uploading.list.length === 0 &&
            acquiringData.list.length === 0 &&
            retryHead === undefined
          ) {
            if (result !== 'all-queued') {
              cancelEverythingAndSetError();
              throw new Error('remaining parts were not all queued despite nothing happening');
            }

            stateVWC.set('success');
            stateVWC.callbacks.call(undefined);
            return;
          }

          try {
            await Promise.race([
              canceled.promise,
              ...uploading.list.map((v) => v.task.promise),
              ...acquiringData.list.map((v) => v.task.promise),
              ...(retryHead === undefined ? [] : [retryHead.task.promise]),
            ]);
          } catch {}
        }
      }
    } finally {
      canceled.cancel();
    }
  }

  async function uploadOuter() {
    try {
      await uploadInner();
    } finally {
      if (stateVWC.get() === 'running') {
        cancelEverythingAndSetError();
      }
    }
  }
};

/**
 * The standard upload getData function when you have the data you want to upload
 * as a blob already.
 *
 * @param complete The blob that contains the data to upload
 * @returns The getData function to use
 */
export const uploadStandardBlobGetData =
  (complete: Blob): ((part: UploadPart) => CancelablePromise<Blob>) =>
  (part) => ({
    promise: Promise.resolve(
      complete.slice(part.startByte, part.endByte, 'application/octet-stream')
    ),
    done: () => true,
    cancel: () => {},
  });

/**
 * Uses the standard file upload endpoint with the given uid and jwt to upload
 * each part
 * @param fileUploadUID The UID for the file upload being performed
 * @param fileUploadJWT The JWT that lets us upload the file
 * @returns The tryUpload function to use
 */
export const uploadStandardEndpointTryUpload =
  (
    fileUploadUID: string,
    fileUploadJWT: string
  ): ((part: Omit<UploadPartStateUploading, 'task'>) => CancelablePromise<TryUploadResult>) =>
  (part) =>
    constructCancelablePromise({
      body: async (state, resolve, reject) => {
        await adaptCallbacksToAbortSignal(state.cancelers, async (signal) => {
          const formData = new FormData();
          formData.append('file', part.data, 'file');
          let response: Response;
          try {
            response = await apiFetch(
              `/api/1/file_uploads/${fileUploadUID}/${part.number}`,
              {
                method: 'POST',
                headers: {
                  Authorization: `bearer ${fileUploadJWT}`,
                },
                body: formData,
                signal,
              },
              null
            );
          } catch (e) {
            if (state.finishing) {
              state.done = true;
              reject(new Error('canceled'));
              return;
            }

            state.finishing = true;
            state.done = true;
            resolve({ type: 'retryable-error', minRetryTimeMS: 0 });
            return;
          }

          if (state.finishing) {
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          if (response.ok) {
            state.finishing = true;
            state.done = true;
            resolve({ type: 'success' });
            return;
          }

          const retryAfterRaw = response.headers.get('retry-after');
          if (retryAfterRaw !== null) {
            let retryAfter: number = NaN;
            try {
              retryAfter = parseInt(retryAfterRaw, 10);
            } catch {}

            if (!isNaN(retryAfter) && retryAfter > 0 && retryAfter <= 180) {
              state.finishing = true;
              state.done = true;
              resolve({ type: 'retryable-error', minRetryTimeMS: retryAfter * 1000 });
              return;
            }
          }

          if (
            response.status === 429 ||
            response.status === 502 ||
            response.status === 503 ||
            response.status === 504
          ) {
            state.finishing = true;
            state.done = true;
            resolve({ type: 'retryable-error', minRetryTimeMS: 0 });
            return;
          }

          state.finishing = true;
          state.done = true;
          resolve({ type: 'non-retryable-error' });
          return;
        });
      },
    });
