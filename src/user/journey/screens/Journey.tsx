import { ReactElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useFullHeight } from '../../../shared/hooks/useFullHeight';
import { OsehImageFromState } from '../../../shared/OsehImage';
import styles from './Journey.module.css';
import assistiveStyles from '../../../shared/assistive.module.css';
import { JourneyScreenProps } from '../models/JourneyScreenProps';
import { IconButton } from '../../../shared/forms/IconButton';
import { useFavoritedModal } from '../../favorites/hooks/useFavoritedModal';
import { useUnfavoritedModal } from '../../favorites/hooks/useUnfavoritedModal';
import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContext } from '../../../shared/LoginContext';
import { ErrorBlock, describeError } from '../../../shared/forms/ErrorBlock';

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
export const Journey = ({
  journey,
  shared,
  setScreen,
  onCloseEarly,
}: JourneyScreenProps & {
  /**
   * If specified, instead of just using setScreen('post') for both the
   * audio ending normally and the user clicking the x to skip the remaining
   * audio, instead we use setScreen('post') if it ends normally and
   * onCloseEarly if the user clicks the x to skip the remaining audio.
   */
  onCloseEarly?: (currentTime: number, totalTime: number) => void;
}): ReactElement => {
  const loginContext = useContext(LoginContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const [controlsVisibility, setControlsVisibility] = useState<'visible' | 'hiding' | 'hidden'>(
    'visible'
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [showLikedUntil, setShowLikedUntil] = useState<number | undefined>(undefined);
  const [showUnlikedUntil, setShowUnlikedUntil] = useState<number | undefined>(undefined);
  const [likeError, setLikeError] = useState<ReactElement | null>(null);

  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSize: shared.windowSize });

  useEffect(() => {
    const audio = shared.audio?.audioRef?.current;
    if (!audio) {
      return;
    }

    const handler = () => {
      setScreen('post', false);
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

  useFavoritedModal(showLikedUntil);
  useUnfavoritedModal(showUnlikedUntil);

  const onClickedClose = useCallback(() => {
    if (shared.audio?.stop) {
      shared.audio.stop();
    }

    if (onCloseEarly !== undefined) {
      onCloseEarly(currentTime, journey.durationSeconds);
    } else {
      setScreen('post', true);
    }
  }, [setScreen, shared.audio, currentTime, journey.durationSeconds, onCloseEarly]);

  const audioProgressStyle = useMemo(() => {
    return {
      width: `${(currentTime / journey.durationSeconds) * 100}%`,
    };
  }, [currentTime, journey.durationSeconds]);

  const onToggleFavorited = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      if (shared.favorited === null) {
        return;
      }

      e.preventDefault();
      setShowLikedUntil(undefined);
      setShowUnlikedUntil(undefined);
      setLikeError(null);

      try {
        const response = await apiFetch(
          '/api/1/users/me/journeys/likes' +
            (shared.favorited ? '?uid=' + encodeURIComponent(journey.uid) : ''),
          shared.favorited
            ? {
                method: 'DELETE',
              }
            : {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify({
                  journey_uid: journey.uid,
                }),
              },
          loginContext
        );
        if (!response.ok) {
          throw response;
        }

        const nowFavorited = !shared.favorited;
        shared.setFavorited.call(undefined, nowFavorited);
        if (nowFavorited) {
          setShowLikedUntil(Date.now() + 5000);
        } else {
          setShowUnlikedUntil(Date.now() + 5000);
        }
      } catch (err) {
        const desc = await describeError(err);
        setLikeError(desc);
      }
    },
    [shared.favorited, journey.uid, loginContext, shared.setFavorited]
  );

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
          <button type="button" className={styles.close} onClick={onClickedClose}>
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
          <div className={styles.titleAndInstructor}>
            <div className={styles.title}>{journey.title}</div>
            <div className={styles.instructor}>{journey.instructor.name}</div>
          </div>
          {shared.favorited !== null && (
            <div className={styles.likeContainer}>
              <IconButton
                icon={shared.favorited ? styles.fullHeartIcon : styles.emptyHeartIcon}
                srOnlyName={shared.favorited ? 'Unlike' : 'Like'}
                onClick={onToggleFavorited}
                disabled={false}
              />
            </div>
          )}
          {likeError && <ErrorBlock>{likeError}</ErrorBlock>}
        </div>
      </div>
    </div>
  );
};
