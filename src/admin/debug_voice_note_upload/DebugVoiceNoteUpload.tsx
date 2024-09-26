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
import { parseUploadInfoFromResponse, UploadInfo } from '../../shared/upload/UploadInfo';
import { JobRef } from '../../shared/jobProgress/JobRef';
import { uploadPart } from '../../shared/upload/uploadPart';
import { apiFetch } from '../../shared/ApiConstants';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';

export const DebugVoiceNoteUpload = (): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const managingVWC = useWritableValueWithCallbacks<boolean>(() => false);
  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const progressVWC = useWritableValueWithCallbacks<JobProgress>(
    () => new OrderedDictionary<Job, 'uid', 'startedAt'>('uid', 'startedAt')
  );
  const haveProgressVWC = useMappedValueWithCallbacks(
    progressVWC,
    (prog) => prog.peakHead() !== undefined
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

const transitionFromUpload = async (
  ctx: UploadContext,
  state: UploadStateUpload
): Promise<UploadStateProcess | UploadStateError> => {
  const parts = getSimpleUploadParts(state.info);
  const parallel = Math.min(parts.endPartNumber, 5);

  const message = `uploading ${state.file.name} (${parts.totalBytes} bytes split into ${
    parts.endPartNumber
  } part${parts.endPartNumber === 1 ? '' : 's'}), ${parallel} part${
    parallel === 1 ? '' : 's'
  } at a time`;

  setMainJobMsg(ctx, {
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
      setMainJobMsg(ctx, {
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
      setMainJobMsg(ctx, {
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
    return { type: 'process', job: state.info.progress, voiceNote: state.voiceNote };
  } else {
    return { type: 'error', error: <>no progress to use</> };
  }
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
