import { ReactElement, useContext } from 'react';
import { CancelablePromise } from '../../lib/CancelablePromise';
import styles from './UploaderContent.module.css';
import {
  Callbacks,
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
import { ErrorBlock, describeError } from '../../forms/ErrorBlock';
import { combineClasses } from '../../lib/combineClasses';
import { InlineOsehSpinner } from '../../components/InlineOsehSpinner';
import { computeFileSha512 } from '../../computeFileSha512';
import { HTTP_WEBSOCKET_URL, apiFetch } from '../../ApiConstants';
import { UploadInfo, parseUploadInfoFromResponse } from '../UploadInfo';
import { getSimpleUploadParts } from '../SimpleUploadParts';
import { uploadPart } from '../uploadPart';
import { createCancelablePromiseFromCallbacks } from '../../lib/createCancelablePromiseFromCallbacks';
import { useValueWithCallbacksEffect } from '../../hooks/useValueWithCallbacksEffect';

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

type IndicatorSpinner = { type: 'spinner' };
type IndicatorBar = { type: 'bar'; at: number; of: number };
type Indicator = IndicatorSpinner | IndicatorBar;

type Progress = {
  message: string;
  indicator: Indicator | null;
};

type UploadContext<T extends object> = Pick<
  UploaderContentProps<T>,
  'startEndpoint' | 'poller' | 'onUploaded' | 'signal'
> & {
  loginContextRaw: LoginContextValue;
  progress: WritableValueWithCallbacks<Progress>;
};

// uploading is naturally represented via a finite state machine
// without loops

type UploadStateHash = { type: 'hash'; file: File };
type UploadStateDedup = { type: 'dedup'; file: File; sha512: string };
type UploadStateStart = { type: 'start'; file: File; sha512: string };
type UploadStateUpload = { type: 'upload'; file: File; sha512: string; info: UploadInfo };
type UploadStateProcess = { type: 'process'; sha512: string; job: JobRef };
type UploadStatePoll = { type: 'poll'; sha512: string; startedAt: Date; timeoutSeconds: number };
type UploadStateError = { type: 'error'; error: ReactElement };
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

const transitionFromPick = async <T extends object>(
  ctx: UploadContext<T>,
  file: File
): Promise<UploadStateHash | UploadStateError> => {
  if (ctx.loginContextRaw.value.get().state !== 'logged-in') {
    return {
      type: 'error',
      error: <>not logged in</>,
    };
  }
  if (ctx.signal?.aborted) {
    return {
      type: 'error',
      error: <>aborted</>,
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
    setVWC(ctx.progress, {
      message: 'hashing file locally',
      indicator: { type: 'bar', at: hashed.get(), of: fileSize },
    });
  });
  hashed.callbacks.call(undefined);

  try {
    const sha512 = await computeFileSha512(state.file, hashed, ctx.signal);
    return { type: 'dedup', file: state.file, sha512 };
  } catch (e) {
    return { type: 'error', error: <>Error hashing file: {`${e}`}</> };
  }
};

const transitionFromDedup = async <T extends object>(
  ctx: UploadContext<T>,
  state: UploadStateDedup
): Promise<UploadStateStart | UploadStateComplete<T> | UploadStateError> => {
  setVWC(ctx.progress, {
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
      return { type: 'error', error: <>aborted</> };
    }

    return { type: 'error', error: await describeError(e) };
  }
};

const transitionFromStart = async <T extends object>(
  ctx: UploadContext<T>,
  state: UploadStateStart
): Promise<UploadStateUpload | UploadStateError> => {
  const loginContextUnch = ctx.loginContextRaw.value.get();
  if (loginContextUnch.state !== 'logged-in') {
    return { type: 'error', error: <>not logged in</> };
  }
  const loginContext = loginContextUnch;

  setVWC(ctx.progress, { message: 'initializing upload', indicator: { type: 'spinner' } });
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
      return { type: 'error', error: <>aborted</> };
    }

    return { type: 'error', error: await describeError(e) };
  }
};

const transitionFromUpload = async <T extends object>(
  ctx: UploadContext<T>,
  state: UploadStateUpload
): Promise<UploadStateProcess | UploadStatePoll | UploadStateError> => {
  const parts = getSimpleUploadParts(state.info);
  const parallel = Math.min(parts.endPartNumber, 5);

  const message = `uploading ${state.file.name} (${parts.totalBytes} bytes split into ${
    parts.endPartNumber
  } part${parts.endPartNumber === 1 ? '' : 's'}), ${parallel} part${
    parallel === 1 ? '' : 's'
  } at a time`;

  setVWC(ctx.progress, {
    message: message,
    indicator: { type: 'bar', at: 0, of: parts.totalBytes },
  });

  const uploading: Map<number, Promise<void>> = new Map();
  let nextPartNumber = 1;
  let numFinishedBytes = 0;
  let reportedFinishedBytes = 0;
  const endPartNumber = parts.endPartNumber;

  const doPart = async (partNumber: number) => {
    const part = parts.getPart(partNumber);
    await uploadPart(
      state.file,
      part.number,
      part.startByte,
      part.endByte,
      state.info.uid,
      state.info.jwt,
      ctx.signal
    );
    numFinishedBytes += part.endByte - part.startByte;
    uploading.delete(partNumber);
  };

  let resolveAborted = () => {};
  const abortedPromise = new Promise<void>((resolve, reject) => {
    const doResolve = () => {
      ctx.signal?.removeEventListener('abort', doResolve);
      resolve();
    };

    resolveAborted = doResolve;
    ctx.signal?.addEventListener('abort', doResolve);
    if (ctx.signal?.aborted) {
      doResolve();
    }
  });

  while (nextPartNumber <= endPartNumber || uploading.size > 0) {
    if (ctx.signal?.aborted) {
      break;
    }

    if (reportedFinishedBytes !== numFinishedBytes) {
      reportedFinishedBytes = numFinishedBytes;
      setVWC(ctx.progress, {
        message: message,
        indicator: { type: 'bar', at: numFinishedBytes, of: parts.totalBytes },
      });
    }

    while (nextPartNumber <= endPartNumber && uploading.size < parallel) {
      const num = nextPartNumber;
      nextPartNumber++;
      uploading.set(num, doPart(num));
    }

    try {
      const promises = [abortedPromise];

      const iter = uploading.values();
      let next = iter.next();
      while (!next.done) {
        promises.push(next.value);
        next = iter.next();
      }

      await Promise.race(promises);
    } catch (e) {
      resolveAborted();
      setVWC(ctx.progress, {
        message: 'upload failed, waiting for in-progress uploads to settle',
        indicator: { type: 'spinner' },
      });
      await Promise.allSettled(uploading.values());

      if (ctx.signal?.aborted) {
        return { type: 'error', error: <>aborted</> };
      }

      return { type: 'error', error: await describeError(e) };
    }
  }

  if (ctx.signal?.aborted) {
    await Promise.allSettled(uploading.values());
    return { type: 'error', error: <>aborted</> };
  }

  resolveAborted();
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
  setVWC(ctx.progress, {
    message: 'connecting to processing job progress report',
    indicator: { type: 'spinner' },
  });

  let lastFailedAt: Date | null = null;
  let recentFailures = 0;
  let failureDetected = false;

  const manageSocket = async () => {
    const socket = new WebSocket(`${HTTP_WEBSOCKET_URL}/api/2/jobs/live`);

    const abortHandler = () => {
      socket.close();
      ctx.signal?.removeEventListener('abort', abortHandler);
    };
    ctx.signal?.addEventListener('abort', abortHandler);
    if (ctx.signal?.aborted) {
      abortHandler();
      throw new Error('aborted');
    }

    try {
      await manageSocketInner(socket);
    } catch (e) {
      if (ctx.signal?.aborted) {
        return;
      }
      throw e;
    } finally {
      ctx.signal?.removeEventListener('abort', abortHandler);
    }
  };

  const manageSocketInner = async (socket: WebSocket) => {
    let packetQueue: string[] = [];
    const onReceivedPacket = new Callbacks<undefined>();
    socket.addEventListener('message', (e) => {
      const data = e.data;
      if (typeof data !== 'string') {
        throw new Error(`WebSocket message was not a string: ${data}`);
      }
      packetQueue.push(data);
      onReceivedPacket.call(undefined);
    });

    const erroredOrClosed = new Promise<void>((resolve) => {
      const doResolve = () => {
        resolve();
        socket.removeEventListener('error', doResolve);
        socket.removeEventListener('close', doResolve);
      };

      socket.addEventListener('error', doResolve);
      socket.addEventListener('close', doResolve);
    });

    const readPacketOrClose = async (): Promise<string | undefined> => {
      const result = packetQueue.shift();
      if (result !== undefined) {
        return result;
      }
      const readPromise = createCancelablePromiseFromCallbacks(onReceivedPacket);
      readPromise.promise.catch(() => {});
      await Promise.race([readPromise.promise, erroredOrClosed]);
      readPromise.cancel();

      return packetQueue.shift();
    };

    await new Promise<void>((resolve, reject) => {
      const doResolve = () => {
        resolve();
        socket.removeEventListener('open', doResolve);
        socket.removeEventListener('error', doReject);
        socket.removeEventListener('close', doReject);
      };
      const doReject = (e: Event) => {
        reject(new Error(`WebSocket error: ${e}`));
        socket.removeEventListener('open', doResolve);
        socket.removeEventListener('error', doReject);
        socket.removeEventListener('close', doReject);
      };

      socket.addEventListener('open', doResolve);
      socket.addEventListener('error', doReject);
      socket.addEventListener('close', doReject);
    });

    socket.send(
      JSON.stringify({
        type: 'authorize',
        data: {
          job_uid: state.job.uid,
          jwt: state.job.jwt,
        },
      })
    );

    const authResponseRaw = await readPacketOrClose();
    if (authResponseRaw === undefined) {
      throw new Error('WebSocket closed before auth response');
    }

    const authResponse = JSON.parse(authResponseRaw);
    if (authResponse.type !== 'auth_response' || authResponse.success !== true) {
      throw new Error(`WebSocket auth failed: ${authResponseRaw}`);
    }

    const finalEventTypes = new Set(['failed', 'succeeded']);

    while (true) {
      const packetRaw = await readPacketOrClose();
      if (packetRaw === undefined) {
        throw new Error('connection closed');
      }

      const packet = JSON.parse(packetRaw);
      if (packet.type !== 'event_batch') {
        throw new Error(`Unexpected packet type: ${packet.type}`);
      }

      if (packet.success !== true) {
        throw new Error(`Event batch failed: ${packetRaw}`);
      }

      const events: {
        type: string;
        message: string;
        indicator: Indicator | { type: 'final' } | null;
      }[] = packet.data.events;
      let seenFinal = false;
      for (const event of events) {
        if (
          finalEventTypes.has(event.type) ||
          (event.indicator !== null && event.indicator.type === 'final')
        ) {
          seenFinal = true;
          failureDetected = event.type === 'failed';
          break;
        }
      }

      if (events.length > 0) {
        const lastEvent = events[events.length - 1];
        setVWC(ctx.progress, {
          message: lastEvent.message,
          indicator:
            lastEvent.indicator === null || lastEvent.indicator.type === 'final'
              ? null
              : lastEvent.indicator,
        });
      }

      if (seenFinal) {
        socket.close();
        return;
      }
    }
  };

  while (true) {
    if (ctx.signal?.aborted) {
      return { type: 'error', error: <>aborted</> };
    }

    try {
      await manageSocket();
      if (ctx.signal?.aborted) {
        return { type: 'error', error: <>aborted</> };
      }
      if (failureDetected) {
        return { type: 'error', error: <>processing job failed</> };
      }
      return { type: 'poll', sha512: state.sha512, startedAt: new Date(), timeoutSeconds: 30 };
    } catch (e) {
      if (ctx.signal?.aborted) {
        return { type: 'error', error: <>aborted</> };
      }

      console.error('websocket error:', e);
      const now = new Date();
      const timeSinceLastMS = lastFailedAt === null ? null : now.getTime() - lastFailedAt.getTime();
      lastFailedAt = now;

      if (timeSinceLastMS !== null && timeSinceLastMS > 15000) {
        recentFailures = 0;
      } else {
        recentFailures++;
      }

      if (recentFailures > 5 || (timeSinceLastMS !== null && timeSinceLastMS < 1000)) {
        return { type: 'poll', sha512: state.sha512, startedAt: new Date(), timeoutSeconds: 600 };
      }

      setVWC(ctx.progress, {
        message: 'reconnecting to processing job progress report',
        indicator: { type: 'spinner' },
      });
    }
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

  setVWC(ctx.progress, {
    message: message(),
    indicator: { type: 'spinner' },
  });

  const endTimeMS = state.startedAt.getTime() + state.timeoutSeconds * 1000;

  while (true) {
    if (ctx.signal?.aborted) {
      return { type: 'error', error: <>aborted</> };
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
        setVWC(ctx.progress, {
          message: 'complete',
          indicator: null,
        });
        return { type: 'complete', item: response };
      }
    } catch (e) {
      if (ctx.signal?.aborted) {
        return { type: 'error', error: <>aborted</> };
      }

      consecutiveErrors++;
      if (consecutiveErrors > 5) {
        return { type: 'error', error: await describeError(e) };
      }
    }

    if (Date.now() > endTimeMS) {
      return { type: 'error', error: <>poll timeout</> };
    }

    setVWC(ctx.progress, {
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
  const error = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const progress = useWritableValueWithCallbacks<Progress>(() => ({
    message: 'setting up',
    indicator: null,
  }));

  useValueWithCallbacksEffect(progress, (prog) => {
    console.log('progress:', prog);
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
                        progress,
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
                    setVWC(progress, { message: 'setting up', indicator: null });
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
          return <ErrorBlock>{err}</ErrorBlock>;
        }}
      />
    </div>
  );
};

const ProgressDisplay = ({
  progress,
}: {
  progress: WritableValueWithCallbacks<Progress>;
}): ReactElement => {
  return (
    <RenderGuardedComponent
      props={progress}
      component={(prog) => (
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
      )}
    />
  );
};
