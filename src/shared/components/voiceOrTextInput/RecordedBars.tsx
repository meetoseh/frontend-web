import { useEffect } from 'react';
import { AudioFileData } from '../../content/OsehContentTarget';
import {
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../lib/Callbacks';
import { setVWC } from '../../lib/setVWC';
import { waitForValueWithCallbacksConditionCancelable } from '../../lib/waitForValueWithCallbacksCondition';
import { waitForAnimationFrameCancelable } from '../../lib/waitForAnimationFrameCancelable';
import { createCancelablePromiseFromCallbacks } from '../../lib/createCancelablePromiseFromCallbacks';
import { RecordingBars, RecordingBarSettings } from './RecordingBars';
import { useReactManagedValueAsValueWithCallbacks } from '../../hooks/useReactManagedValueAsValueWithCallbacks';
import { OsehColors } from '../../OsehColors';
import { RenderGuardedComponent } from '../RenderGuardedComponent';
import { xAxisPhysicalPerLogical } from '../../images/DisplayRatioHelper';

export type RecordedBarsProps = {
  /** The playable audio to show bars for, undefined to drop seeking behavior */
  audio: AudioFileData | undefined;
  /** The estimated duration of the audio in seconds */
  audioDurationSeconds: number;
  /**
   * The available binned time vs intensity graphs in descending order
   * of number of bins
   */
  intensity: Float32Array[];
  /** The width in logical pixels to use */
  width: number;
  /** The height in logical pixels to use */
  height: number;
};

/**
 * Renders the RecordingBars for an audio file that you have in a playable
 * state. This will left-align the content within the container if there is
 * too much space available.
 *
 * This wraps recording bars with the following functionality:
 * - The current time of the audio is visually indicated by a lighter/brighter color
 *   for the portion of the bars representing time before the current time
 * - This will try to display _all_ the bars, rather than just the last N bars
 *   that fit. This is accomplished by choosing the intensity array that will
 *   actually fit then resizing it up where possible to do a better job filling the
 *   container.
 *
 * Other notable characterstics:
 * - This will always return an element that takes up the given DOM width and height,
 *   but visually it may take up less. In that case, the actual content will be left
 *   aligned within this container. Thus it can make sense to have slightly less padding
 *   right of this than usual.
 */
export const RecordedBars = (props: RecordedBarsProps) => {
  const zeroVWC = useWritableValueWithCallbacks(() => 0);
  const progressVWC = useWritableValueWithCallbacks(() =>
    props.audio === undefined ? 0 : props.audio.element.currentTime / props.audioDurationSeconds
  );

  useEffect(() => {
    if (props.audio === undefined) {
      setVWC(progressVWC, 0);
      return;
    }
    const audio = props.audio;

    const active = createWritableValueWithCallbacks(true);
    const paused = createWritableValueWithCallbacks(audio.element.paused);
    const ended = createWritableValueWithCallbacks(false);
    audio.element.addEventListener('play', onPlay);
    audio.element.addEventListener('pause', onPause);
    audio.element.addEventListener('ended', onEnded);
    handleProgressUpdateLoop();
    return () => {
      setVWC(active, false);
      audio.element.removeEventListener('play', onPlay);
      audio.element.removeEventListener('pause', onPause);
      audio.element.removeEventListener('ended', onEnded);
    };
    function onPlay() {
      setVWC(ended, false);
      setVWC(paused, false);
      updateProgress();
    }
    function onPause() {
      setVWC(paused, true);
      updateProgress();
    }
    function onEnded() {
      setVWC(ended, true);
      updateProgress();
    }
    function updateProgress() {
      if (ended.get()) {
        setVWC(progressVWC, 1);
        return;
      }

      const goingToUseDuration =
        !isNaN(audio.element.duration) && isFinite(audio.element.duration)
          ? audio.element.duration
          : props.audioDurationSeconds;
      setVWC(progressVWC, audio.element.currentTime / goingToUseDuration);
    }

    async function handleProgressUpdateLoop() {
      const canceled = waitForValueWithCallbacksConditionCancelable(active, (v) => !v);
      canceled.promise.catch(() => {});
      while (true) {
        if (!active.get()) {
          canceled.cancel();
          return;
        }

        updateProgress();

        if (!paused.get()) {
          const nextFrame = waitForAnimationFrameCancelable();
          nextFrame.promise.catch(() => {});
          await Promise.race([nextFrame.promise, canceled.promise]);
          nextFrame.cancel();
        } else {
          const unpaused = waitForValueWithCallbacksConditionCancelable(paused, (v) => !v);
          unpaused.promise.catch(() => {});
          const endedChanged = createCancelablePromiseFromCallbacks(ended.callbacks);
          endedChanged.promise.catch(() => {});
          await Promise.race([unpaused.promise, canceled.promise, endedChanged.promise]);
          unpaused.cancel();
          endedChanged.cancel();
        }
      }
    }
  }, [props.audio, progressVWC, props.audioDurationSeconds]);

  const recordingBarsSettings: Omit<RecordingBarSettings, 'color'> = {
    width: props.width,
    height: props.height,
    barWidth: 2,
    barSpacing: 1,
    align: 'left',
  };
  const maxBarsThatCanFit = Math.floor(
    recordingBarsSettings.width /
      (recordingBarsSettings.barWidth + recordingBarsSettings.barSpacing)
  );
  const intensity = (() => {
    for (let i = 0; i < props.intensity.length; i++) {
      if (props.intensity[i].length <= maxBarsThatCanFit) {
        return props.intensity[i];
      }
    }
    return props.intensity[props.intensity.length - 1];
  })();

  const intensityVWC = useReactManagedValueAsValueWithCallbacks(intensity, Object.is);

  const barWidthPercAsSpacing = 0.33333334;
  const rescaledAssignedBarWidth = props.width / (intensity.length - barWidthPercAsSpacing);
  recordingBarsSettings.barWidth =
    Math.floor(rescaledAssignedBarWidth * (1 - barWidthPercAsSpacing) * xAxisPhysicalPerLogical) /
    xAxisPhysicalPerLogical;
  recordingBarsSettings.barSpacing =
    Math.floor(rescaledAssignedBarWidth * barWidthPercAsSpacing * xAxisPhysicalPerLogical) /
    xAxisPhysicalPerLogical;

  while (
    recordingBarsSettings.barWidth + recordingBarsSettings.barSpacing + xAxisPhysicalPerLogical <=
    rescaledAssignedBarWidth
  ) {
    recordingBarsSettings.barWidth += xAxisPhysicalPerLogical;
  }

  const realWidth =
    intensity.length * (recordingBarsSettings.barWidth + recordingBarsSettings.barSpacing);

  return (
    <div
      style={{ position: 'absolute', width: props.width, height: props.height, left: 0, top: 0 }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: props.width,
          height: props.height,
          zIndex: 0,
          overflow: 'hidden',
        }}>
        <RecordingBars
          intensity={intensityVWC}
          offset={zeroVWC}
          settings={{ ...recordingBarsSettings, color: OsehColors.v4.primary.grey }}
        />
      </div>
      <RenderGuardedComponent
        props={progressVWC}
        component={(progress) => (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: progress >= 0.99 ? props.width : realWidth * progress,
              height: props.height,
              zIndex: 0,
              overflow: 'hidden',
            }}>
            <RecordingBars
              intensity={intensityVWC}
              offset={zeroVWC}
              settings={{ ...recordingBarsSettings, color: OsehColors.v4.primary.light }}
            />
          </div>
        )}
      />
    </div>
  );
};
