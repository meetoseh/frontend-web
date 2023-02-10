import { ReactElement, useCallback, useEffect, useRef } from 'react';
import { useFullHeight } from '../../../shared/hooks/useFullHeight';
import { OsehImageFromState } from '../../../shared/OsehImage';
import styles from './Journey.module.css';
import assistiveStyles from '../../../shared/assistive.module.css';
import { JourneyScreenProps } from '../models/JourneyScreenProps';

/**
 * Takes the meta information about a journey returned from any of the endpoints
 * which start a session in the journey (e.g., start_random), then uses that to
 * connect to the "live" information (the true live events, the historical
 * events, profile pictures, and the stats endpoints) and playback the journey
 * to the user, while they are allowed to engage via the prompt and a "like"
 * button.
 */
export const Journey = ({ journey, shared, setScreen }: JourneyScreenProps): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);

  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSize: shared.windowSize });

  useEffect(() => {
    const audio = shared.audio?.audioRef?.current;
    if (!audio) {
      return;
    }

    const handler = () => {
      setScreen('post');
    };

    if (audio.ended) {
      handler();
      return;
    }

    audio.addEventListener('ended', handler);
    return () => {
      audio.removeEventListener('ended', handler);
    };
  }, [shared.audio, setScreen]);

  const gotoPost = useCallback(() => {
    if (shared.audio?.stop) {
      shared.audio.stop();
    }

    setScreen('post');
  }, [setScreen, shared.audio]);

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.backgroundImageContainer}>
        {shared.image && <OsehImageFromState {...shared.image} />}
      </div>
      <div className={styles.closeButtonContainer}>
        <div className={styles.closeButtonInnerContainer}>
          <button type="button" className={styles.close} onClick={gotoPost}>
            <div className={styles.closeIcon} />
            <div className={assistiveStyles.srOnly}>Close</div>
          </button>
        </div>
      </div>
      <div className={styles.innerContainer}>
        <div className={styles.content}>
          <div className={styles.title}>{journey.title}</div>
          <div className={styles.instructor}>{journey.instructor.name}</div>
        </div>
      </div>
    </div>
  );
};
