import { ReactElement } from 'react';
import styles from './Journey.module.css';
import { JourneyScreenProps } from '../models/JourneyScreenProps';
import { useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { OsehImageFromStateValueWithCallbacks } from '../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { useWindowSizeValueWithCallbacks } from '../../../shared/hooks/useWindowSize';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';
import { useMediaInfo } from '../../../shared/content/useMediaInfo';
import { useCurrentTranscriptPhrases } from '../../../shared/transcripts/useCurrentTranscriptPhrases';
import { PlayerForeground } from '../../../shared/content/player/PlayerForeground';
import { useReactManagedValueAsValueWithCallbacks } from '../../../shared/hooks/useReactManagedValueAsValueWithCallbacks';
import { useOsehTranscriptValueWithCallbacks } from '../../../shared/transcripts/useOsehTranscriptValueWithCallbacks';

/**
 * Takes the meta information about a journey returned from any of the endpoints
 * which start a session in the journey (e.g., start_random), then uses that to
 * connect to the "live" information (the true live events, the historical
 * events, profile pictures, and the stats endpoints) and playback the journey
 * to the user, while they are allowed to engage via the prompt and a "like"
 * button.
 */
export const Journey = ({
  journey,
  shared,
  setScreen,
  onCloseEarly,
}: JourneyScreenProps & {
  /**
   * If specified, instead of just using setScreen('feedback') for both the
   * audio ending normally and the user clicking the x to skip the remaining
   * audio, instead we use setScreen('feedback') if it ends normally and
   * onCloseEarly if the user clicks the x to skip the remaining audio.
   */
  onCloseEarly?: (currentTime: number, totalTime: number) => void;
}): ReactElement => {
  const windowSizeVWC = useWindowSizeValueWithCallbacks();

  const rawTranscriptVWC = useOsehTranscriptValueWithCallbacks({
    type: 'react-rerender',
    props: journey.transcript,
  });
  const transcript = useCurrentTranscriptPhrases({
    transcript: useMappedValueWithCallbacks(rawTranscriptVWC, (v) =>
      v.type === 'loading' ? null : v.type === 'success' ? v.transcript : undefined
    ),
  });
  const mediaVWC = useMappedValueWithCallbacks(shared, (s) => s.audio);
  const mediaInfo = useMediaInfo({
    mediaVWC,
    currentTranscriptPhrasesVWC: transcript,
    durationSeconds: journey.durationSeconds,
  });

  useValueWithCallbacksEffect(mediaInfo.ended, (ended) => {
    if (ended) {
      setScreen('feedback', false);
    }
    return undefined;
  });

  return (
    <div className={styles.container}>
      <div className={styles.background}>
        <OsehImageFromStateValueWithCallbacks
          state={useMappedValueWithCallbacks(shared, (s) => s.darkenedImage)}
        />
      </div>
      <div className={styles.foreground}>
        <PlayerForeground
          size={windowSizeVWC}
          content={mediaVWC}
          mediaInfo={mediaInfo}
          transcript={transcript}
          title={useReactManagedValueAsValueWithCallbacks(journey.title)}
          subtitle={useReactManagedValueAsValueWithCallbacks(journey.instructor.name)}
          onClose={useWritableValueWithCallbacks(() => async () => {
            if (onCloseEarly) {
              onCloseEarly(
                mediaInfo.currentTime.get(),
                mediaInfo.totalTime.get().seconds ?? journey.durationSeconds
              );
            } else {
              setScreen('feedback', true);
            }
          })}
          assumeDark
        />
      </div>
    </div>
  );
};
