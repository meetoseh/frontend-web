import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFullHeight } from '../../../shared/hooks/useFullHeight';
import { OsehImageFromState } from '../../../shared/OsehImage';
import styles from './Journey.module.css';
import assistiveStyles from '../../../shared/assistive.module.css';
import { JourneyScreenProps } from '../models/JourneyScreenProps';

const HIDE_TIME = 10000;
const HIDING_TIME = 365;

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
  const [controlsVisibility, setControlsVisibility] = useState<'visible' | 'hiding' | 'hidden'>(
    'visible'
  );
  const [currentTime, setCurrentTime] = useState(0);

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

  useEffect(() => {
    const audio = shared.audio?.audioRef?.current;
    if (!audio) {
      return;
    }

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    onTimeUpdate();
    audio.addEventListener('timeupdate', onTimeUpdate);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [shared.audio]);

  useEffect(() => {
    setControlsVisibility('visible');
    const audio = shared.audio?.audioRef?.current;
    if (!audio) {
      return;
    }
    if (audio.paused) {
      return;
    }

    const doHide = () => {
      setControlsVisibility('hiding');
      timeout = setTimeout(() => {
        timeout = null;
        setControlsVisibility('hidden');
      }, HIDING_TIME);
    };

    let timeout: NodeJS.Timeout | null = setTimeout(doHide, HIDE_TIME);

    const onUserInput = () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      setControlsVisibility('visible');
      timeout = setTimeout(doHide, HIDE_TIME);
    };

    window.addEventListener('mousemove', onUserInput);
    window.addEventListener('touchstart', onUserInput);
    window.addEventListener('touchmove', onUserInput);
    window.addEventListener('touchend', onUserInput);
    window.addEventListener('touchcancel', onUserInput);
    window.addEventListener('keydown', onUserInput);

    return () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      window.removeEventListener('mousemove', onUserInput);
      window.removeEventListener('touchstart', onUserInput);
      window.removeEventListener('touchmove', onUserInput);
      window.removeEventListener('touchend', onUserInput);
      window.removeEventListener('touchcancel', onUserInput);
      window.removeEventListener('keydown', onUserInput);
    };
  }, [shared.audio?.audioRef]);

  const gotoPost = useCallback(() => {
    if (shared.audio?.stop) {
      shared.audio.stop();
    }

    setScreen('post');
  }, [setScreen, shared.audio]);

  const audioProgressStyle = useMemo(() => {
    return {
      width: `${(currentTime / journey.durationSeconds) * 100}%`,
    };
  }, [currentTime, journey.durationSeconds]);

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.backgroundImageContainer}>
        {shared.image && <OsehImageFromState {...shared.image} />}
      </div>
      <div
        className={`${styles.closeButtonContainer} ${styles.control} ${
          styles['control_' + controlsVisibility]
        }`}>
        <div className={styles.closeButtonInnerContainer}>
          <button type="button" className={styles.close} onClick={gotoPost}>
            <div className={styles.closeIcon} />
            <div className={assistiveStyles.srOnly}>Close</div>
          </button>
        </div>
      </div>
      <div
        className={`${styles.audioControlsContainer} ${styles.control} ${
          styles['control_' + controlsVisibility]
        }`}>
        <div className={styles.audioControlsInnerContainer}>
          <div className={styles.audioProgressContainer}>
            <div className={styles.audioProgress} style={audioProgressStyle}></div>
            <div className={styles.audioProgressCircle}></div>
          </div>
        </div>
      </div>
      <div
        className={`${styles.innerContainer} ${styles.control} ${
          styles['control_' + controlsVisibility]
        }`}>
        <div className={styles.content}>
          <div className={styles.title}>{journey.title}</div>
          <div className={styles.instructor}>{journey.instructor.name}</div>
        </div>
      </div>
    </div>
  );
};
