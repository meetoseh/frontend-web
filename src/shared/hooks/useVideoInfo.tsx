import { MutableRefObject, useCallback, useMemo, useRef } from 'react';
import { OsehVideoContentState } from '../content/OsehVideoContentState';
import {
  Callbacks,
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../lib/Callbacks';
import { OsehTranscriptPhrase } from '../transcripts/OsehTranscript';
import { UseCurrentTranscriptPhrasesResult } from '../transcripts/useCurrentTranscriptPhrases';
import { useMappedValueWithCallbacks } from './useMappedValueWithCallbacks';
import { useValueWithCallbacksEffect } from './useValueWithCallbacksEffect';
import { setVWC } from '../lib/setVWC';
import { useMappedValuesWithCallbacks } from './useMappedValuesWithCallbacks';

export type VideoInfo = {
  /** True if the video is ready to play, false otherwise */
  loaded: ValueWithCallbacks<boolean>;
  /** True if the video is currently playing, false if paused */
  playing: ValueWithCallbacks<boolean>;
  /** Inverted playing; true if currently paused, false if playing */
  paused: ValueWithCallbacks<boolean>;
  /** True if the video is software muted, false if not software muted */
  muted: ValueWithCallbacks<boolean>;
  /** The current playback time in seconds */
  currentTime: ValueWithCallbacks<number>;
  /** The combination of loaded and playing as a string enum, usually for the play button */
  playPauseState: ValueWithCallbacks<'playing' | 'paused' | 'loading'>;
  /** If the video is at the end and hasn't started again */
  ended: ValueWithCallbacks<boolean>;
  /** Closed captioning information */
  closedCaptioning: {
    /** The phrases to render */
    phrases: ValueWithCallbacks<{ phrase: OsehTranscriptPhrase; id: number }[]>;
    /** If closed captioning is actually available (vs always empty phrases) */
    available: ValueWithCallbacks<boolean>;
    /** Can be written to to enable/disable closed captioning */
    enabled: WritableValueWithCallbacks<boolean>;
    /** The combined available and enabled booleans */
    state: ValueWithCallbacks<{ enabled: boolean; available: boolean }>;
  };
  /** The total duration of the video in seconds, and formatted for display */
  totalTime: ValueWithCallbacks<{ seconds?: number; formatted: string }>;
};

/**
 * Convenience hook for extracting all the common information about a video
 * into the most consumable form.
 *
 * This will handle setting the current time for the current transcript
 * phrases.
 */
export const useVideoInfo = ({
  videoVWC,
  currentTranscriptPhrasesVWC,
}: {
  videoVWC: ValueWithCallbacks<OsehVideoContentState>;
  currentTranscriptPhrasesVWC: ValueWithCallbacks<UseCurrentTranscriptPhrasesResult>;
}): VideoInfo => {
  const videoLoadedVWC = useMappedValueWithCallbacks(videoVWC, (v) => v.loaded);
  const videoPlayingVWC = useWritableValueWithCallbacks(() => false);
  const videoPausedVWC = useMappedValueWithCallbacks(videoPlayingVWC, (v) => !v);
  const videoMutedVWC = useWritableValueWithCallbacks(() => false);
  const videoCurrentTimeVWC = useWritableValueWithCallbacks(() => 0);
  const videoTotalTimeVWC = useWritableValueWithCallbacks<{ seconds?: number; formatted: string }>(
    () => ({ formatted: '?:??' })
  );
  const videoEndedVWC = useWritableValueWithCallbacks(() => false);

  useValueWithCallbacksEffect(
    videoVWC,
    useCallback(
      (v) => {
        if (v.state !== 'loaded') {
          return;
        }
        const vid = v.video;
        vid.addEventListener('play', handlePausedChanged);
        vid.addEventListener('pause', handlePausedChanged);
        vid.addEventListener('ended', handleEnded);
        vid.addEventListener('volumechange', handleMutedChanged);
        vid.addEventListener('timeupdate', handleTimeChanged);
        vid.addEventListener('loadedmetadata', handleMetadataChanged);
        handlePausedChanged();
        handleMutedChanged();
        handleMetadataChanged();
        return () => {
          vid.removeEventListener('play', handlePausedChanged);
          vid.removeEventListener('pause', handlePausedChanged);
          vid.removeEventListener('ended', handleEnded);
          vid.removeEventListener('volumechange', handleMutedChanged);
          vid.removeEventListener('timeupdate', handleTimeChanged);
          vid.removeEventListener('loadedmetadata', handleMetadataChanged);
        };

        function handlePausedChanged() {
          if (vid.paused && vid.ended) {
            // pause event can sometimes be issued before ended, but no
            // matter what it's convenient if we set ended first so we
            // don't store "fake" pause events in in-app sessions
            setVWC(videoEndedVWC, true);
          }

          const playing = !vid.paused && !vid.ended;
          setVWC(videoPlayingVWC, playing);
          if (playing) {
            setVWC(videoEndedVWC, false);
          }
        }

        function handleEnded() {
          setVWC(videoEndedVWC, true);
          handlePausedChanged();
        }

        function handleMutedChanged() {
          setVWC(videoMutedVWC, vid.muted);
        }

        function handleTimeChanged() {
          setVWC(videoCurrentTimeVWC, vid.currentTime);
        }

        function handleMetadataChanged() {
          const duration = vid.duration;
          if (isNaN(duration)) {
            setVWC(
              videoTotalTimeVWC,
              { formatted: '?:??' },
              (a, b) => a.formatted === b.formatted && a.seconds === b.seconds
            );
          }

          setVWC(
            videoTotalTimeVWC,
            {
              seconds: vid.duration,
              formatted: formatSeconds(vid.duration),
            },
            (a, b) => a.formatted === b.formatted && a.seconds === b.seconds
          );
        }
      },
      [videoPlayingVWC, videoCurrentTimeVWC, videoMutedVWC]
    )
  );
  const videoPlayPauseStateVWC = useMappedValuesWithCallbacks(
    [videoLoadedVWC, videoPlayingVWC],
    (): 'loading' | 'playing' | 'paused' => {
      if (!videoLoadedVWC.get()) {
        return 'loading';
      }
      if (videoPlayingVWC.get()) {
        return 'playing';
      }
      return 'paused';
    }
  );

  const closedCaptioningPhrasesVWC = useMappedValueWithCallbacks(
    currentTranscriptPhrasesVWC,
    (v) => v.phrases
  );
  const closedCaptioningAvailableVWC = useMappedValueWithCallbacks(
    currentTranscriptPhrasesVWC,
    (v) => {
      return v.type !== 'unavailable';
    }
  );
  const closedCaptioningEnabledVWC = useWritableValueWithCallbacks(() => true);

  const closedCaptioningStateVWC = useMappedValuesWithCallbacks(
    [closedCaptioningAvailableVWC, closedCaptioningEnabledVWC],
    () => ({
      available: closedCaptioningAvailableVWC.get(),
      enabled: closedCaptioningEnabledVWC.get(),
    }),
    {
      outputEqualityFn: (a, b) => a.available === b.available && a.enabled === b.enabled,
    }
  );

  useValueWithCallbacksEffect(videoCurrentTimeVWC, (currentTime) => {
    setVWC(currentTranscriptPhrasesVWC.get().currentTime, currentTime);
    return undefined;
  });

  return useMemo(
    () => ({
      loaded: videoLoadedVWC,
      playing: videoPlayingVWC,
      paused: videoPausedVWC,
      muted: videoMutedVWC,
      currentTime: videoCurrentTimeVWC,
      playPauseState: videoPlayPauseStateVWC,
      ended: videoEndedVWC,
      closedCaptioning: {
        phrases: closedCaptioningPhrasesVWC,
        available: closedCaptioningAvailableVWC,
        enabled: closedCaptioningEnabledVWC,
        state: closedCaptioningStateVWC,
      },
      totalTime: videoTotalTimeVWC,
    }),
    [
      videoLoadedVWC,
      videoPlayingVWC,
      videoPausedVWC,
      videoMutedVWC,
      videoCurrentTimeVWC,
      videoPlayPauseStateVWC,
      videoEndedVWC,
      currentTranscriptPhrasesVWC,
      closedCaptioningPhrasesVWC,
      closedCaptioningAvailableVWC,
      closedCaptioningEnabledVWC,
      closedCaptioningStateVWC,
      videoTotalTimeVWC,
    ]
  );
};

const formatSeconds = (durationSeconds: number) => {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.floor(durationSeconds % 60);

  return `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
};
