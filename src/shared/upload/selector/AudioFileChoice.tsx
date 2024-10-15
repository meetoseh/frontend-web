import { RenderGuardedComponent } from '../../components/RenderGuardedComponent';
import { OsehContent } from '../../content/OsehContent';
import { OsehContentRef } from '../../content/OsehContentRef';
import { useWritableValueWithCallbacks } from '../../lib/Callbacks';
import { OsehTranscriptRef } from '../../transcripts/OsehTranscriptRef';
import styles from './AudioFileChoice.module.css';
import { setVWC } from '../../lib/setVWC';
import { useOsehTranscriptValueWithCallbacks } from '../../transcripts/useOsehTranscriptValueWithCallbacks';
import { InlineOsehSpinner } from '../../components/InlineOsehSpinner';
import { Button } from '../../forms/Button';
import { BoxError } from '../../lib/errors';

export type AudioFileChoiceProps = {
  /**
   * The audio to show
   */
  audio: OsehContentRef;

  /**
   * The transcript for the audio, if available
   */
  transcript: OsehTranscriptRef | null;

  /**
   * The function to call when the audio is selected
   */
  onClick: () => void;
};

/**
 * The standard way to display an audio file choice, which shows the
 * audio file with controls, an optional transcript, and a select
 * button which calls the given function when clicked.
 */
export const AudioFileChoice = ({
  audio,
  transcript: transcriptRef,
  onClick,
}: AudioFileChoiceProps) => {
  const transcript = useOsehTranscriptValueWithCallbacks({
    type: 'react-rerender',
    props: transcriptRef,
  });
  const transcriptExpanded = useWritableValueWithCallbacks(() => false);

  return (
    <div className={styles.container}>
      <OsehContent uid={audio.uid} jwt={audio.jwt} />
      <RenderGuardedComponent
        props={transcript}
        component={(transcript) => {
          if (transcriptRef === null) {
            return (
              <div className={styles.transcriptUnavailable}>
                Transcripts are only generated once the speaker is known, for accuracy
              </div>
            );
          }
          if (transcript.type === 'loading') {
            return (
              <div className={styles.transcriptLoading}>
                <InlineOsehSpinner
                  size={{
                    type: 'react-rerender',
                    props: {
                      height: 48,
                    },
                  }}
                />
              </div>
            );
          }
          if (transcript.type === 'error') {
            return <BoxError error={transcript.error} />;
          }

          const phrases = transcript.transcript.phrases;
          return (
            <RenderGuardedComponent
              props={transcriptExpanded}
              component={(expanded) => {
                const toShow = expanded ? phrases : phrases.slice(0, 1);

                return (
                  <button
                    type="button"
                    className={styles.transcript}
                    onClick={(e) => {
                      e.preventDefault();
                      setVWC(transcriptExpanded, !transcriptExpanded.get());
                    }}>
                    {toShow.map((phrase, index) => (
                      <div key={index} className={styles.transcriptPhrase}>
                        {phrase.phrase}
                      </div>
                    ))}
                  </button>
                );
              }}
            />
          );
        }}
      />
      <div className={styles.selectContainer}>
        <Button
          type="button"
          variant="outlined"
          onClick={(e) => {
            e.preventDefault();
            onClick();
          }}>
          Select
        </Button>
      </div>
    </div>
  );
};
