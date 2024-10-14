import { useEffect, useRef } from 'react';
import { VoiceNoteStateMachine } from '../../../user/core/screens/journal_chat/lib/createVoiceNoteStateMachine';
import { useWritableValueWithCallbacks } from '../../lib/Callbacks';
import { useValueWithCallbacksEffect } from '../../hooks/useValueWithCallbacksEffect';
import { OsehStyles } from '../../OsehStyles';
import { RenderGuardedComponent } from '../RenderGuardedComponent';
import { useMappedValueWithCallbacks } from '../../hooks/useMappedValueWithCallbacks';
import { VerticalSpacer } from '../VerticalSpacer';
import { Cancel } from '../icons/Cancel';
import { OsehColors } from '../../OsehColors';
import { combineClasses } from '../../lib/combineClasses';
import styles from './VoiceOrTextInputVoice.module.css';
import { setVWC } from '../../lib/setVWC';
import { HorizontalSpacer } from '../HorizontalSpacer';
import { RecordingBars } from './RecordingBars';
import { formatDurationClock } from '../../lib/networkResponseUtils';
import { Stop } from '../icons/Stop';
import { Send } from '../icons/Send';
import { RESIZING_TEXT_AREA_ICON_SETTINGS } from '../ResizingTextArea';
import { AudioPlayPauseIcon } from './AudioPlayPauseButton';
import { AutoWidthRecordedBars } from './AutoWidthRecordedBars';

export type VoiceOrTextInputVoiceProps = {
  /** The user no longer wants to send audio */
  onCancel: () => void;
  /**
   * The user finished their voice note and wants to send it. The voice note
   * at least made it to recording, and they could have been so fast that it's
   * still in the recording step. In that case, though, we will have already
   * sent the stop-recording message.
   *
   * If they waited long enough after recording this may have already made it
   * to the local-ready step.
   */
  onSend: (voiceNote: VoiceNoteStateMachine) => void;

  voiceNote: VoiceNoteStateMachine;
};

/**
 * Immediately upon being shown tries to start recording with the given voice note
 *
 * Generally not used directly, but instead as a subcomponent of VoiceOrTextInput
 */
export const VoiceOrTextInputVoice = (props: VoiceOrTextInputVoiceProps) => {
  const voiceNote = props.voiceNote;
  const startedRecordingRef = useRef(false);
  useValueWithCallbacksEffect(voiceNote.state, (state) => {
    if (startedRecordingRef.current) {
      if (state.type === 'recording') {
        startedRecordingRef.current = false;
      }
      return;
    }
    if (state.type !== 'initialized-for-recording') {
      return undefined;
    }
    startedRecordingRef.current = true;
    voiceNote.sendMessage({ type: 'record' });
    return undefined;
  });

  const barsContainerRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const barsContainerWidthVWC = useWritableValueWithCallbacks<number>(() => 0);

  useValueWithCallbacksEffect(barsContainerRef, (r) => {
    if (r === null) {
      return undefined;
    }

    let active = true;
    const observer = new ResizeObserver((entries) => {
      if (!active) {
        return;
      }
      for (const entry of entries) {
        setVWC(barsContainerWidthVWC, entry.contentRect.width);
        break;
      }
    });
    observer.observe(r);
    setVWC(barsContainerWidthVWC, r.clientWidth);
    return () => {
      active = false;
      observer.disconnect();
    };
  });

  return (
    <div className={OsehStyles.layout.row}>
      <RenderGuardedComponent
        props={useMappedValueWithCallbacks(
          voiceNote.state,
          (s) =>
            s.type !== 'initializing-for-recording' &&
            s.type !== 'initialized-for-recording' &&
            s.type !== 'recording'
        )}
        component={(shouldShow) =>
          !shouldShow ? (
            <></>
          ) : (
            <button
              className={OsehStyles.unstyling.buttonAsColumn}
              onClick={(e) => {
                e.preventDefault();
                const current = voiceNote.state.get();
                current?.audio?.playable?.element?.pause();
                if (current.type !== 'released') {
                  voiceNote.sendMessage({ type: 'release' });
                }
                props.onCancel();
              }}>
              <VerticalSpacer height={0} flexGrow={1} />
              <Cancel
                color={OsehColors.v4.primary.darkGrey}
                color2={OsehColors.v4.primary.light}
                icon={{ width: 30 }}
                container={{ width: 42, height: 48 }}
                startPadding={{ x: { fraction: 0 }, y: { fraction: 0.5 } }}
              />
              <VerticalSpacer height={0} flexGrow={1} />
              <div className={OsehStyles.assistive.srOnly}>Cancel</div>
            </button>
          )
        }
      />
      <RenderGuardedComponent
        props={useMappedValueWithCallbacks(voiceNote.state, (s) =>
          s.type === 'error' ? s.error : s.type === 'released' ? <>Reference released</> : null
        )}
        component={(err) =>
          err === null ? (
            <></>
          ) : (
            <div className={OsehStyles.layout.column} style={{ flexGrow: 1 }}>
              <VerticalSpacer height={0} flexGrow={1} />
              <div
                className={combineClasses(
                  OsehStyles.typography.detail2,
                  OsehStyles.colors.v4.experimental.lightError
                )}>
                {err}
              </div>
              <VerticalSpacer height={0} flexGrow={1} />
            </div>
          )
        }
      />
      <div className={styles.container}>
        <RenderGuardedComponent
          props={useMappedValueWithCallbacks(voiceNote.state, (s) => s?.audio?.playable?.element)}
          component={(audio) =>
            audio === undefined ? (
              <HorizontalSpacer width={12} />
            ) : (
              <>
                <HorizontalSpacer width={12} />
                <button
                  type="button"
                  className={OsehStyles.unstyling.buttonAsColumn}
                  onClick={(e) => {
                    e.preventDefault();
                    if (audio.paused) {
                      audio.play();
                    } else {
                      audio.pause();
                    }
                  }}>
                  <VerticalSpacer height={0} flexGrow={1} />
                  <AudioPlayPauseIcon audio={audio} />
                  <VerticalSpacer height={0} flexGrow={1} />
                </button>
                <HorizontalSpacer width={12} />
              </>
            )
          }
        />
        <RenderGuardedComponent
          props={useMappedValueWithCallbacks(voiceNote.state, (s) =>
            s.type === 'recording' ? s : null
          )}
          component={(state) =>
            state === null ? (
              <></>
            ) : (
              <>
                <div
                  className={OsehStyles.layout.column}
                  style={{ flexGrow: 1 }}
                  ref={(r) => setVWC(barsContainerRef, r)}>
                  <RenderGuardedComponent
                    props={barsContainerWidthVWC}
                    component={(width) => (
                      <RecordingBars
                        intensity={state.audio.analysis.timeVsAverageSignalIntensity}
                        offset={state.audio.analysis.timeVsAverageSignalIntensityOffset}
                        settings={{
                          width,
                          barWidth: 3,
                          barSpacing: 1,
                          height: 50,
                          color: OsehColors.v4.primary.light,
                          align: 'right',
                        }}
                      />
                    )}
                  />
                </div>
                <HorizontalSpacer width={18} />
                <DurationSince
                  since={state.recordingStartedAt.asDateNow}
                  className={combineClasses(
                    OsehStyles.typography.body,
                    OsehStyles.colors.v4.primary.grey
                  )}
                />
                <HorizontalSpacer width={18} />
                <button
                  className={OsehStyles.unstyling.buttonAsColumn}
                  onClick={(e) => {
                    e.preventDefault();
                    voiceNote.sendMessage({ type: 'stop-recording' });
                  }}>
                  <VerticalSpacer height={0} flexGrow={1} />
                  <Stop
                    icon={{ width: 30 }}
                    container={{ width: 30, height: 30 }}
                    startPadding={{ x: { fraction: 0.5 }, y: { fraction: 0.5 } }}
                    color={OsehColors.v4.primary.light}
                    color2={OsehColors.v4.primary.dark}
                  />
                  <VerticalSpacer height={0} flexGrow={1} />
                  <div className={OsehStyles.assistive.srOnly}>Stop recording</div>
                </button>
                <HorizontalSpacer width={12} />
              </>
            )
          }
        />
        <RenderGuardedComponent
          props={useMappedValueWithCallbacks(voiceNote.state, (s) =>
            s.type === 'uploading' || s.type === 'transcribing' || s.type === 'local-ready'
              ? s
              : null
          )}
          component={(state) =>
            state === null ? (
              <></>
            ) : (
              <>
                <AutoWidthRecordedBars
                  audio={state.audio.playable}
                  audioDurationSeconds={state.audio.durationSeconds}
                  intensity={state.audio.timeVsAverageSignalIntensity}
                  height={44}
                />
                <HorizontalSpacer width={12} />
                <div
                  className={combineClasses(
                    OsehStyles.typography.body,
                    OsehStyles.colors.v4.primary.grey
                  )}>
                  {formatDurationClock(state.audio.durationSeconds, {
                    minutes: true,
                    seconds: true,
                    milliseconds: false,
                  })}
                </div>
                <button
                  type="button"
                  className={OsehStyles.unstyling.buttonAsColumn}
                  onClick={(e) => {
                    e.preventDefault();
                    if (!state.audio.playable.element.paused) {
                      state.audio.playable.element.pause();
                    }
                    if (state.audio.playable.element.currentTime !== 0) {
                      state.audio.playable.element.currentTime = 0;
                    }
                    props.onSend(voiceNote);
                  }}>
                  <VerticalSpacer height={0} flexGrow={1} />
                  <Send
                    color={OsehColors.v4.primary.light}
                    color2={OsehColors.v4.primary.dark}
                    {...RESIZING_TEXT_AREA_ICON_SETTINGS}
                  />
                  <VerticalSpacer height={0} flexGrow={1} />
                  <div className={OsehStyles.assistive.srOnly}>Send</div>
                </button>
              </>
            )
          }
        />
      </div>
    </div>
  );
};

const DurationSince = (props: { since: number; className: string }) => {
  const durationSecondsVWC = useWritableValueWithCallbacks<number>(() =>
    Math.floor((Date.now() - props.since) / 1000)
  );
  useEffect(() => {
    let active = true;
    let timeout: NodeJS.Timeout | null = setTimeout(updateTime, 0);
    return () => {
      active = false;
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    function updateTime() {
      timeout = null;
      if (!active) {
        return;
      }
      const now = Date.now();
      const timeSinceMS = now - props.since;
      const timeSinceSeconds = Math.floor(timeSinceMS / 1000);
      const timeUntilNextSecond = 1000 - (timeSinceMS % 1000);
      setVWC(durationSecondsVWC, timeSinceSeconds);
      timeout = setTimeout(updateTime, timeUntilNextSecond);
    }
  }, [props.since, durationSecondsVWC]);
  return (
    <RenderGuardedComponent
      props={durationSecondsVWC}
      component={(seconds) => (
        <div className={props.className}>
          {formatDurationClock(seconds, { minutes: true, seconds: true, milliseconds: false })}
        </div>
      )}
    />
  );
};
