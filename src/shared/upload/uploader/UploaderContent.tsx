import { ReactElement, useContext } from 'react';
import { CancelablePromise } from '../../lib/CancelablePromise';
import styles from './UploaderContent.module.css';
import {
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../lib/Callbacks';
import { JobRef } from '../../jobProgress/JobRef';
import {
  LoginContext,
  LoginContextValue,
  LoginContextValueLoggedIn,
} from '../../contexts/LoginContext';
import { RenderGuardedComponent } from '../../components/RenderGuardedComponent';
import { setVWC } from '../../lib/setVWC';
import { combineClasses } from '../../lib/combineClasses';
import { InlineOsehSpinner } from '../../components/InlineOsehSpinner';
import { computeFileSha512 } from '../../computeFileSha512';
import { apiFetch } from '../../ApiConstants';
import { UploadInfo, convertToRange, parseUploadInfoFromResponse } from '../UploadInfo';
import { useValueWithCallbacksEffect } from '../../hooks/useValueWithCallbacksEffect';
import { OrderedDictionary } from '../../lib/OrderedDictionary';
import { Job, JobProgress, Progress, trackJobProgress } from '../../jobProgress/trackJobProgress';
import {
  upload,
  uploadStandardBlobGetData,
  uploadStandardEndpointTryUpload,
} from '../../lib/uploadHelpers';
import { waitForValueWithCallbacksConditionCancelable } from '../../lib/waitForValueWithCallbacksCondition';
import { createMappedValueWithCallbacks } from '../../hooks/useMappedValueWithCallbacks';
import { createMappedValuesWithCallbacks } from '../../hooks/useMappedValuesWithCallbacks';
import { BoxError, DisplayableError } from '../../lib/errors';

export type UploaderContentProps<T extends object> = {
  /**
   * Explains what can be uploaded and how it will be used. For images,
   * for example, this should describe the minimum resolution required.
   */
  description: ReactElement;

  /**
   * The endpoint that starts the upload process by returning
   * an UploadInfo in the response.
   */
  startEndpoint:
    | {
        type: 'path';
        /**
         * The path to the endpoint that starts the upload process.
         */
        path: string;
        /**
         * Additional parameters included in the body besides the
         * `file_size`.
         */
        additionalBodyParameters: Record<string, unknown> | undefined;
      }
    | {
        type: 'function';
        /**
         * Attempt to start the upload process for a file with the given size,
         * returning the upload info, rejecting if there are network issues
         * or a non-successful response.
         *
         * @param fileSize The size of the file to upload, in bytes
         * @param loginContext The login context to use for the request
         * @param signal The signal to abort the request early, if supported
         * @returns The upload info
         */
        fn: (
          fileSize: number,
          loginContext: LoginContextValueLoggedIn,
          signal: AbortSignal | undefined
        ) => Promise<UploadInfo>;
      };

  /**
   * The MIME type of the files that can be uploaded. This doesn't
   * enforce anything, but it does make the file picker easier to use.
   */
  accept: string;

  /**
   * The function which can fetch the product of the upload based on the
   * sha512 of the original file. This is used both to skip the upload
   * if the file is already uploaded and to fetch the result of the upload
   * after it's complete.
   *
   * If the job supports progress information, we don't attempt to poll until
   * we see a final event, otherwise we begin polling immediately.
   *
   * Usually, this is constructed via `createUploadPoller`.
   *
   * @param sha512 The sha512 of the original file
   * @returns The result of the upload, or null if the upload is not yet complete
   */
  poller: (sha512: string) => CancelablePromise<T | null>;

  /**
   * The function to call once the upload product has been determined, whether
   * because it had already been uploaded or because the upload and corresponding
   * processing is complete.
   *
   * @param result The result of the upload
   */
  onUploaded: (result: T) => void;

  /**
   * If specified, used to abort uploads early.
   */
  signal?: AbortSignal;
};

type UploadContext<T extends object> = Pick<
  UploaderContentProps<T>,
  'startEndpoint' | 'poller' | 'onUploaded' | 'signal'
> & {
  loginContextRaw: LoginContextValue;
  /**
   * A client-side generated uid for the main upload job.
   */
  uploadJobUid: string;
  /**
   * The jobs which are currently processing this file. Theres the main upload
   * job which corresponds both to the work done client-side and, if the upload
   * endpoint supports progress reporting, the immediate progress job. However,
   * if t he endpoint supports progress reporting, we support cascading jobs
   * that
   */
  jobs: WritableValueWithCallbacks<JobProgress>;
};

// uploading is naturally represented via a finite state machine
// without loops

type UploadStateHash = { type: 'hash'; file: File };
type UploadStateDedup = { type: 'dedup'; file: File; sha512: string };
type UploadStateStart = { type: 'start'; file: File; sha512: string };
type UploadStateUpload = { type: 'upload'; file: File; sha512: string; info: UploadInfo };
type UploadStateProcess = { type: 'process'; sha512: string; job: JobRef };
type UploadStatePoll = { type: 'poll'; sha512: string; startedAt: Date; timeoutSeconds: number };
type UploadStateError = { type: 'error'; error: DisplayableError };
type UploadStateComplete<T extends object> = { type: 'complete'; item: T };
type UploadState<T extends object> =
  | UploadStateHash
  | UploadStateDedup
  | UploadStateStart
  | UploadStateUpload
  | UploadStateProcess
  | UploadStatePoll
  | UploadStateError
  | UploadStateComplete<T>;

const setJobMsg = <T extends object>(
  ctx: UploadContext<T>,
  jobUid: string,
  name: string,
  progress: Progress
) => {
  const map = ctx.jobs.get();
  const job = map.get(jobUid);
  if (job === undefined) {
    map.push({
      uid: jobUid,
      name,
      progress: progress,
      startedAt: Date.now(),
      result: null,
    });
  } else {
    job.progress = progress;
  }
  ctx.jobs.callbacks.call(undefined);
};

const setMainJobMsg = <T extends object>(ctx: UploadContext<T>, progress: Progress): void => {
  setJobMsg(ctx, ctx.uploadJobUid, 'overall', progress);
};

const transitionFromPick = async <T extends object>(
  ctx: UploadContext<T>,
  file: File
): Promise<UploadStateHash | UploadStateError> => {
  if (ctx.loginContextRaw.value.get().state !== 'logged-in') {
    return {
      type: 'error',
      error: new DisplayableError('server-refresh-required', 'select file', 'not logged in'),
    };
  }
  if (ctx.signal?.aborted) {
    return {
      type: 'error',
      error: new DisplayableError('canceled', 'select file'),
    };
  }
  return { type: 'hash', file };
};

const transitionFromHash = async <T extends object>(
  ctx: UploadContext<T>,
  state: UploadStateHash
): Promise<UploadStateDedup | UploadStateError> => {
  const fileSize = state.file.size;
  const hashed = createWritableValueWithCallbacks(0);
  hashed.callbacks.add(() => {
    setMainJobMsg(ctx, {
      message: 'hashing file locally',
      indicator: { type: 'bar', at: hashed.get(), of: fileSize },
    });
  });
  hashed.callbacks.call(undefined);

  try {
    const sha512 = await computeFileSha512(state.file, hashed, ctx.signal);
    return { type: 'dedup', file: state.file, sha512 };
  } catch (e) {
    return { type: 'error', error: new DisplayableError('client', 'hash file', `${e}`) };
  }
};

const transitionFromDedup = async <T extends object>(
  ctx: UploadContext<T>,
  state: UploadStateDedup
): Promise<UploadStateStart | UploadStateComplete<T> | UploadStateError> => {
  setMainJobMsg(ctx, {
    message: 'checking if the file has already been processed',
    indicator: { type: 'spinner' },
  });
  try {
    const polledCancelable = ctx.poller(state.sha512);

    ctx.signal?.addEventListener('abort', polledCancelable.cancel);
    if (ctx.signal?.aborted) {
      polledCancelable.cancel();
    }

    let polled: T | null;
    try {
      polled = await polledCancelable.promise;
    } finally {
      ctx.signal?.removeEventListener('abort', polledCancelable.cancel);
    }

    if (polled === null) {
      return { type: 'start', file: state.file, sha512: state.sha512 };
    } else {
      return { type: 'complete', item: polled };
    }
  } catch (e) {
    if (ctx.signal?.aborted) {
      return {
        type: 'error',
        error: new DisplayableError('canceled', 'check if already uploaded'),
      };
    }

    return {
      type: 'error',
      error:
        e instanceof DisplayableError
          ? e
          : new DisplayableError('client', 'check if already uploaded', `${e}`),
    };
  }
};

const transitionFromStart = async <T extends object>(
  ctx: UploadContext<T>,
  state: UploadStateStart
): Promise<UploadStateUpload | UploadStateError> => {
  const loginContextUnch = ctx.loginContextRaw.value.get();
  if (loginContextUnch.state !== 'logged-in') {
    return {
      type: 'error',
      error: new DisplayableError('server-refresh-required', 'start upload', 'not logged in'),
    };
  }
  const loginContext = loginContextUnch;

  setMainJobMsg(ctx, { message: 'initializing upload', indicator: { type: 'spinner' } });
  let info: UploadInfo;
  try {
    ctx.signal?.throwIfAborted();
    if (ctx.startEndpoint.type === 'path') {
      const response = await apiFetch(
        ctx.startEndpoint.path,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            ...(ctx.startEndpoint.additionalBodyParameters ?? {}),
            file_size: state.file.size,
          }),
          signal: ctx.signal,
        },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      ctx.signal?.throwIfAborted();
      const rawInfo = await response.json();
      info = parseUploadInfoFromResponse(rawInfo);
    } else {
      info = await ctx.startEndpoint.fn(state.file.size, loginContext, undefined);
    }
    return { type: 'upload', file: state.file, sha512: state.sha512, info };
  } catch (e) {
    if (ctx.signal?.aborted) {
      return { type: 'error', error: new DisplayableError('canceled', 'start upload') };
    }

    return {
      type: 'error',
      error:
        e instanceof DisplayableError ? e : new DisplayableError('client', 'start upload', `${e}`),
    };
  }
};

const transitionFromUpload = async <T extends object>(
  ctx: UploadContext<T>,
  state: UploadStateUpload
): Promise<UploadStateProcess | UploadStatePoll | UploadStateError> => {
  const handler = upload({
    parts: state.info.parts.map((v) => {
      const range = convertToRange(v);
      return {
        number: range.startNumber,
        startByte: range.startByte,
        numberOfParts: range.numberOfParts,
        partSize: range.partSize,
      };
    }),
    concurrency: {
      upload: 5,
      acquireData: 3,
    },
    retries: {
      backoff: (n) => Math.pow(2, n) * 1000 + Math.random() * 1000,
      max: 5,
    },
    getData: uploadStandardBlobGetData(state.file),
    tryUpload: uploadStandardEndpointTryUpload(state.info.uid, state.info.jwt),
  });

  ctx.signal?.addEventListener('abort', handler.cancel);
  if (ctx.signal?.aborted) {
    handler.cancel();
  }

  const handlerDone = waitForValueWithCallbacksConditionCancelable(
    handler.state,
    (s) => s !== 'running'
  );
  const [remainingBytesVWC, cleanupRemainingBytes] = createMappedValueWithCallbacks(
    handler.progress.remaining,
    (r) => r.list.reduce((acc, v) => acc + v.partSize * v.numberOfParts, 0)
  );
  const [acquiringDataBytesVWC, cleanupAcquiringDataBytes] = createMappedValueWithCallbacks(
    handler.progress.inprogress.acquiringData,
    (a) => a.list.reduce((acc, v) => acc + v.endByte - v.startByte, 0)
  );
  const [uploadingBytesVWC, cleanupUploadingBytes] = createMappedValueWithCallbacks(
    handler.progress.inprogress.uploading,
    (u) => u.list.reduce((acc, v) => acc + v.endByte - v.startByte, 0)
  );
  const [waitingToRetryBytesVWC, cleanupWaitingToRetryBytes] = createMappedValueWithCallbacks(
    handler.progress.inprogress.waitingToRetry,
    (w) => w.valuesList().reduce((acc, v) => acc + v.endByte - v.startByte, 0)
  );
  const prettyBytes = (bytes: number): string => {
    // bytes / kb / mb / gb
    const units = ['B', 'KB', 'MB', 'GB'];
    let unit = 0;
    while (bytes >= 1024 && unit < units.length - 1) {
      bytes /= 1024;
      unit++;
    }
    return `${bytes.toFixed(2)} ${units[unit]}`;
  };

  const [messageVWC, cleanupMessageVWC] = createMappedValuesWithCallbacks(
    [remainingBytesVWC, acquiringDataBytesVWC, uploadingBytesVWC, waitingToRetryBytesVWC],
    () => {
      const remaining = remainingBytesVWC.get();
      const acquiringData = acquiringDataBytesVWC.get();
      const uploading = uploadingBytesVWC.get();
      const waitingToRetry = waitingToRetryBytesVWC.get();

      let result = `uploading: ${prettyBytes(remaining)} remaining, ${prettyBytes(
        acquiringData
      )} acquiring data, ${prettyBytes(uploading)} uploading`;
      if (waitingToRetry > 0) {
        result += `, ${prettyBytes(waitingToRetry)} waiting to retry`;
      }
      return result;
    }
  );

  const totalBytes = state.file.size;

  while (true) {
    if (handlerDone.done()) {
      break;
    }

    const message = messageVWC.get();
    const remaining = remainingBytesVWC.get();

    setMainJobMsg(ctx, {
      message: message,
      indicator: { type: 'bar', at: totalBytes - remaining, of: totalBytes },
    });

    const messageChangedVWC = waitForValueWithCallbacksConditionCancelable(
      messageVWC,
      (m) => m !== message
    );
    messageChangedVWC.promise.catch(() => {});
    const remainingChangedVWC = waitForValueWithCallbacksConditionCancelable(
      remainingBytesVWC,
      (r) => r !== remaining
    );
    remainingChangedVWC.promise.catch(() => {});
    await Promise.race([
      messageChangedVWC.promise,
      remainingChangedVWC.promise,
      handlerDone.promise,
    ]);
    messageChangedVWC.cancel();
    remainingChangedVWC.cancel();
  }

  cleanupRemainingBytes();
  cleanupAcquiringDataBytes();
  cleanupUploadingBytes();
  cleanupWaitingToRetryBytes();
  cleanupMessageVWC();

  const finalState = handler.state.get();
  if (finalState === 'error') {
    return { type: 'error', error: new DisplayableError('client', 'upload') };
  }

  if (state.info.progress !== undefined) {
    return { type: 'process', sha512: state.sha512, job: state.info.progress };
  } else {
    return { type: 'poll', sha512: state.sha512, startedAt: new Date(), timeoutSeconds: 600 };
  }
};

const transitionFromProcess = async <T extends object>(
  ctx: UploadContext<T>,
  state: UploadStateProcess
): Promise<UploadStatePoll | UploadStateError> => {
  setMainJobMsg(ctx, {
    message: 'waiting for processing to complete',
    indicator: null,
  });

  const prog = trackJobProgress([{ name: 'processing', job: state.job }], ctx.jobs);
  ctx.signal?.addEventListener('abort', prog.cancel);
  if (ctx.signal?.aborted) {
    prog.cancel();
  }

  try {
    await prog.promise;

    for (const job of ctx.jobs.get().valuesList()) {
      if (job.result === false) {
        return {
          type: 'error',
          error: new DisplayableError(
            'server-not-retryable',
            'wait for processing',
            `processing failed (job ${job.name}, last message: ${job.progress.message})`
          ),
        };
      }
    }
    return { type: 'poll', sha512: state.sha512, startedAt: new Date(), timeoutSeconds: 600 };
  } catch (e) {
    if (ctx.signal?.aborted) {
      return { type: 'error', error: new DisplayableError('canceled', 'wait for processing') };
    }

    return {
      type: 'error',
      error:
        e instanceof DisplayableError
          ? e
          : new DisplayableError('client', 'wait for processing', `${e}`),
    };
  } finally {
    ctx.signal?.removeEventListener('abort', prog.cancel);
  }
};

const transitionFromPoll = async <T extends object>(
  ctx: UploadContext<T>,
  state: UploadStatePoll
): Promise<UploadStateComplete<T> | UploadStateError> => {
  const pollIntervalSeconds = 5;
  let pollTimes = 0;
  let consecutiveErrors = 0;

  const message = (): string => {
    const errMess = consecutiveErrors === 0 ? '' : `, ${consecutiveErrors} consecutive errors`;
    return `polling every ${pollIntervalSeconds}s (${pollTimes}${errMess})`;
  };

  setMainJobMsg(ctx, {
    message: message(),
    indicator: { type: 'spinner' },
  });

  const endTimeMS = state.startedAt.getTime() + state.timeoutSeconds * 1000;

  while (true) {
    if (ctx.signal?.aborted) {
      return { type: 'error', error: new DisplayableError('canceled', 'poll for completion') };
    }

    pollTimes++;
    try {
      const responseCancelable = ctx.poller(state.sha512);
      ctx.signal?.addEventListener('abort', responseCancelable.cancel);
      if (ctx.signal?.aborted) {
        responseCancelable.cancel();
      }

      let response: T | null;
      try {
        response = await responseCancelable.promise;
      } finally {
        ctx.signal?.removeEventListener('abort', responseCancelable.cancel);
      }

      consecutiveErrors = 0;
      if (response !== null) {
        setMainJobMsg(ctx, {
          message: 'complete',
          indicator: null,
        });
        return { type: 'complete', item: response };
      }
    } catch (e) {
      if (ctx.signal?.aborted) {
        return { type: 'error', error: new DisplayableError('canceled', 'poll for completion') };
      }

      consecutiveErrors++;
      if (consecutiveErrors > 5) {
        return {
          type: 'error',
          error:
            e instanceof DisplayableError
              ? e
              : new DisplayableError('client', 'poll for completion', `${e}`),
        };
      }
    }

    if (Date.now() > endTimeMS) {
      return {
        type: 'error',
        error: new DisplayableError('server-retryable', 'poll for completion', 'timeout reached'),
      };
    }

    setMainJobMsg(ctx, {
      message: message(),
      indicator: { type: 'spinner' },
    });
    await new Promise((resolve) => setTimeout(resolve, pollIntervalSeconds * 1000));
  }
};

const transitioners = {
  hash: transitionFromHash,
  dedup: transitionFromDedup,
  start: transitionFromStart,
  upload: transitionFromUpload,
  process: transitionFromProcess,
  poll: transitionFromPoll,
};

/**
 * Repeatedly transitions the given state until it's complete or an error occurs.
 *
 * @param ctx The context for the upload
 * @param file The file to upload
 */
const manageFile = async <T extends object>(
  ctx: UploadContext<T>,
  file: File
): Promise<UploadStateComplete<T> | UploadStateError> => {
  let state = (await transitionFromPick(ctx, file)) as UploadState<T>;

  while (state.type !== 'complete' && state.type !== 'error') {
    state = await transitioners[state.type](ctx, state as any);
  }

  return state;
};

/**
 * Shows the given description and allows the user to select a file to upload.
 *
 * Once the user has selected a file, this hashes the file and checks if it's
 * already been processed for this purpose: if it has, skips uploading and
 * goes straight to the result.
 *
 * If the file hasn't been processed, this uploads the file in parts, displaying
 * progress. Then, if the upload endpoint supports processing progress, displays
 * that progress until completion. Finally, polls for the result of the upload
 * until it's available or a timeout is reached.
 *
 * This is expected to be rendered on a dark background.
 */
export const UploaderContent = <T extends object>({
  description,
  startEndpoint,
  accept,
  poller,
  onUploaded,
  signal,
}: UploaderContentProps<T>): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const managing = useWritableValueWithCallbacks<boolean>(() => false);
  const error = useWritableValueWithCallbacks<DisplayableError | null>(() => null);
  const progress = useWritableValueWithCallbacks<JobProgress>(
    () => new OrderedDictionary<Job, 'uid', 'startedAt'>('uid', 'startedAt')
  );
  const uploadJobUid = 'upload';

  useValueWithCallbacksEffect(progress, (prog) => {
    const progressParts: string[] = [];
    for (const { name, progress } of prog.valuesList()) {
      progressParts.push(`  ${name}: ${progress.message} (${JSON.stringify(progress.indicator)})`);
    }
    console.log('progress:\n' + progressParts.join('\n'));
    return undefined;
  });

  return (
    <div className={styles.container}>
      <div className={styles.description}>{description}</div>

      <RenderGuardedComponent
        props={managing}
        component={(working) => {
          if (working) {
            return <ProgressDisplay progress={progress} />;
          }

          return (
            <div className={styles.fileInputContainer}>
              <input
                type="file"
                className={styles.fileInput}
                accept={accept}
                onChange={async (e) => {
                  if (managing.get()) {
                    return;
                  }

                  const file = e.target.files?.[0];
                  if (file === undefined || file === null) {
                    return;
                  }

                  setVWC(managing, true);
                  setVWC(error, null);
                  try {
                    const result = await manageFile(
                      {
                        startEndpoint,
                        poller,
                        onUploaded,
                        loginContextRaw,
                        uploadJobUid,
                        jobs: progress,
                        signal,
                      },
                      file
                    );
                    if (result.type === 'error') {
                      setVWC(error, result.error);
                    } else {
                      onUploaded(result.item);
                    }
                  } finally {
                    setVWC(managing, false);
                    progress.get().clear();
                    progress.callbacks.call(undefined);
                  }
                }}
              />
            </div>
          );
        }}
      />

      <RenderGuardedComponent
        props={error}
        component={(err) => {
          if (err === null) {
            return <></>;
          }
          return <BoxError error={err} />;
        }}
      />
    </div>
  );
};

export const ProgressDisplay = ({
  progress,
}: {
  progress: WritableValueWithCallbacks<JobProgress>;
}): ReactElement => {
  return (
    <RenderGuardedComponent
      props={progress}
      component={(jobs) => (
        <div className={styles.progressesContainer}>
          {jobs.valuesList().map(({ uid, name, progress: prog }) => (
            <div className={styles.progressItem} key={uid}>
              <div className={styles.progressItemJobName}>{name}</div>
              <div
                className={combineClasses(
                  styles.progressContainer,
                  prog.indicator === null ? styles.progressContainerNoIndicator : undefined,
                  prog.indicator?.type === 'spinner'
                    ? styles.progressContainerSpinnerIndicator
                    : undefined,
                  prog.indicator?.type === 'bar' ? styles.progressContainerBarIndicator : undefined
                )}>
                <div className={styles.progressMessage}>{prog.message}</div>
                {prog.indicator?.type === 'spinner' ? (
                  <div className={styles.progressSpinnerContainer}>
                    <InlineOsehSpinner
                      size={{
                        type: 'react-rerender',
                        props: {
                          height: 32,
                        },
                      }}
                    />
                  </div>
                ) : undefined}
                {prog.indicator?.type === 'bar' ? (
                  <div className={styles.progressBarContainer}>
                    <progress value={prog.indicator.at} max={prog.indicator.of} />
                  </div>
                ) : undefined}
              </div>
            </div>
          ))}
        </div>
      )}
    />
  );
};
