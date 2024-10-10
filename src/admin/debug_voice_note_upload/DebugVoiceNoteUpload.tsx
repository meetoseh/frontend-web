import { ReactElement, useContext } from 'react';
import { combineClasses } from '../../shared/lib/combineClasses';
import { OsehStyles } from '../../shared/OsehStyles';
import { Button } from '../../shared/forms/Button';
import { VerticalSpacer } from '../../shared/components/VerticalSpacer';
import {
  useWritableValueWithCallbacks,
  WritableValueWithCallbacks,
} from '../../shared/lib/Callbacks';
import { OrderedDictionary } from '../../shared/lib/OrderedDictionary';
import {
  Job,
  JobProgress,
  Progress,
  trackJobProgress,
} from '../../shared/jobProgress/trackJobProgress';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { ProgressDisplay } from '../../shared/upload/uploader/UploaderContent';
import { LoginContext, LoginContextValue } from '../../shared/contexts/LoginContext';
import { setVWC } from '../../shared/lib/setVWC';
import styles from './DebugVoiceNoteUpload.module.css';
import { describeError, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { getSimpleUploadParts } from '../../shared/upload/SimpleUploadParts';
import {
  convertToRange,
  parseUploadInfoFromResponse,
  UploadInfo,
} from '../../shared/upload/UploadInfo';
import { JobRef } from '../../shared/jobProgress/JobRef';
import { uploadPart } from '../../shared/upload/uploadPart';
import { apiFetch } from '../../shared/ApiConstants';
import {
  createMappedValueWithCallbacks,
  useMappedValueWithCallbacks,
} from '../../shared/hooks/useMappedValueWithCallbacks';
import {
  upload,
  uploadStandardBlobGetData,
  uploadStandardEndpointTryUpload,
} from '../../shared/lib/uploadHelpers';
import { waitForValueWithCallbacksConditionCancelable } from '../../shared/lib/waitForValueWithCallbacksCondition';
import { createMappedValuesWithCallbacks } from '../../shared/hooks/useMappedValuesWithCallbacks';

export const DebugVoiceNoteUpload = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const managingVWC = useWritableValueWithCallbacks<boolean>(() => false);
  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const progressVWC = useWritableValueWithCallbacks<JobProgress>(
    () => new OrderedDictionary<Job, 'uid', 'startedAt'>('uid', 'startedAt')
  );
  const haveProgressVWC = useMappedValueWithCallbacks(
    progressVWC,
    (prog) => prog.peekHead() !== undefined
  );

  const lastResultVWC = useWritableValueWithCallbacks<VoiceNoteRef | null>(() => null);
  const inputVWC = useWritableValueWithCallbacks<HTMLInputElement | null>(() => null);
  const uploadJobUid = 'upload';

  useValueWithCallbacksEffect(progressVWC, (prog) => {
    const progressParts: string[] = [];
    for (const { name, progress } of prog.valuesList()) {
      progressParts.push(`  ${name}: ${progress.message} (${JSON.stringify(progress.indicator)})`);
    }
    console.log('progress:\n' + progressParts.join('\n'));
    return undefined;
  });

  const handleFormSubmit = async () => {
    console.log('form submit');
    const input = inputVWC.get();
    if (input === null) {
      setVWC(errorVWC, <div>Input element not found</div>);
      return;
    }

    const file = input.files?.[0];
    if (file === null || file === undefined) {
      setVWC(errorVWC, <div>No file selected</div>);
      return;
    }

    setVWC(managingVWC, true);
    setVWC(errorVWC, null);
    setVWC(lastResultVWC, null);
    progressVWC.get().clear();
    progressVWC.callbacks.call(undefined);
    const controller = new AbortController();
    const ctx: UploadContext = {
      loginContextRaw,
      uploadJobUid,
      jobs: progressVWC,
      signal: controller.signal,
    };
    try {
      const result = await manageFile(ctx, file);
      if (result.type === 'complete') {
        setVWC(lastResultVWC, result.voiceNote);
      } else {
        setVWC(errorVWC, result.error);
      }
    } finally {
      setMainJobMsg(ctx, {
        message: 'finished',
        indicator: null,
      });
      setVWC(managingVWC, false);
    }
  };

  return (
    <div className={OsehStyles.layout.column}>
      <div className={OsehStyles.layout.row}>
        <div
          className={combineClasses(
            OsehStyles.typography.h1Semibold,
            OsehStyles.colors.v4.primary.dark
          )}>
          Debug Voice Note Upload
        </div>
      </div>
      <RenderGuardedComponent
        props={errorVWC}
        component={(error) =>
          error === null ? (
            <></>
          ) : (
            <>
              <VerticalSpacer height={12} />
              <ErrorBlock>{error}</ErrorBlock>
            </>
          )
        }
      />
      <VerticalSpacer height={32} />
      <RenderGuardedComponent
        props={haveProgressVWC}
        component={(haveProgress) =>
          !haveProgress ? (
            <></>
          ) : (
            <>
              <div className={combineClasses(OsehStyles.layout.column, styles.progressContainer)}>
                <ProgressDisplay progress={progressVWC} />
              </div>
              <VerticalSpacer height={32} />
            </>
          )
        }
      />
      <RenderGuardedComponent
        props={managingVWC}
        component={(working) => {
          if (working) {
            return <></>;
          }

          return (
            <form
              className={OsehStyles.layout.column}
              onSubmit={(e) => {
                e.preventDefault();
                handleFormSubmit();
              }}>
              <input
                type="file"
                className={OsehStyles.typography.detail1}
                accept={'audio/*'}
                ref={(r) => setVWC(inputVWC, r)}
              />
              <VerticalSpacer height={20} />
              <div className={OsehStyles.layout.row}>
                <Button
                  type="submit"
                  variant="filled"
                  onClick={(e) => {
                    e.preventDefault();
                    handleFormSubmit();
                  }}>
                  Upload Audio File
                </Button>
              </div>
            </form>
          );
        }}
      />
    </div>
  );
};

type VoiceNoteRef = { uid: string; jwt: string };

type UploadContext = {
  loginContextRaw: LoginContextValue;
  uploadJobUid: string;
  jobs: WritableValueWithCallbacks<JobProgress>;
  signal: AbortSignal;
};
type UploadStateStart = { type: 'start'; file: File };
type UploadStateUpload = { type: 'upload'; voiceNote: VoiceNoteRef; file: File; info: UploadInfo };
type UploadStateProcess = { type: 'process'; voiceNote: VoiceNoteRef; job: JobRef };
type UploadStateError = { type: 'error'; error: ReactElement };
type UploadStateComplete = { type: 'complete'; voiceNote: VoiceNoteRef };
type UploadState =
  | UploadStateStart
  | UploadStateUpload
  | UploadStateProcess
  | UploadStateError
  | UploadStateComplete;

const transitionFromStart = async (
  ctx: UploadContext,
  state: UploadStateStart
): Promise<UploadStateUpload | UploadStateError> => {
  const loginContextUnch = ctx.loginContextRaw.value.get();
  if (loginContextUnch.state !== 'logged-in') {
    return { type: 'error', error: <>not logged in</> };
  }
  const loginContext = loginContextUnch;

  setMainJobMsg(ctx, { message: 'initializing upload', indicator: { type: 'spinner' } });
  try {
    ctx.signal?.throwIfAborted();
    const response = await apiFetch(
      '/api/1/voice_notes/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
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
    const rawInfo: { voice_note: { uid: string; jwt: string }; file_upload: any } =
      await response.json();
    const info = parseUploadInfoFromResponse(rawInfo.file_upload);
    const voiceNote = rawInfo.voice_note;
    return { type: 'upload', file: state.file, voiceNote, info };
  } catch (e) {
    if (ctx.signal?.aborted) {
      return { type: 'error', error: <>aborted</> };
    }

    return { type: 'error', error: await describeError(e) };
  }
};

const transitionFromUpload = async <T extends object>(
  ctx: UploadContext,
  state: UploadStateUpload
): Promise<UploadStateProcess | UploadStateError> => {
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
    return { type: 'error', error: <>upload failed</> };
  }

  if (state.info.progress === undefined) {
    return { type: 'error', error: <>missing progress</> };
  }

  return { type: 'process', job: state.info.progress, voiceNote: state.voiceNote };
};

const transitionFromProcess = async (
  ctx: UploadContext,
  state: UploadStateProcess
): Promise<UploadStateComplete | UploadStateError> => {
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
          error: (
            <>
              processing failed (job {job.name}, last message: {job.progress.message})
            </>
          ),
        };
      }
    }
    return { type: 'complete', voiceNote: state.voiceNote };
  } catch (e) {
    if (ctx.signal?.aborted) {
      return { type: 'error', error: <>aborted</> };
    }

    return { type: 'error', error: await describeError(e) };
  } finally {
    ctx.signal?.removeEventListener('abort', prog.cancel);
  }
};

const transitioners = {
  start: transitionFromStart,
  upload: transitionFromUpload,
  process: transitionFromProcess,
};

const manageFile = async (
  ctx: UploadContext,
  file: File
): Promise<UploadStateComplete | UploadStateError> => {
  let state = { type: 'start', file } as UploadState;

  while (state.type !== 'complete' && state.type !== 'error') {
    state = await transitioners[state.type](ctx, state as any);
  }

  return state;
};

const setJobMsg = (ctx: UploadContext, jobUid: string, name: string, progress: Progress) => {
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

const setMainJobMsg = (ctx: UploadContext, progress: Progress): void => {
  setJobMsg(ctx, ctx.uploadJobUid, 'overall', progress);
};
