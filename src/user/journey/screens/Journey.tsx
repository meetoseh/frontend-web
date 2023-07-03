import { ReactElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useFullHeight } from '../../../shared/hooks/useFullHeight';
import styles from './Journey.module.css';
import assistiveStyles from '../../../shared/assistive.module.css';
import { JourneyScreenProps } from '../models/JourneyScreenProps';
import { IconButton } from '../../../shared/forms/IconButton';
import { useFavoritedModal } from '../../favorites/hooks/useFavoritedModal';
import { useUnfavoritedModal } from '../../favorites/hooks/useUnfavoritedModal';
import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { ErrorBlock, describeError } from '../../../shared/forms/ErrorBlock';
import { Callbacks } from '../../../shared/lib/Callbacks';
import { OsehImageFromStateValueWithCallbacks } from '../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';

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
   * If specified, instead of just using setScreen('feedback') for both the
   * audio ending normally and the user clicking the x to skip the remaining
   * audio, instead we use setScreen('feedback') if it ends normally and
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
  const windowSize = useWindowSize();

  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSize });

  useEffect(() => {
    const cleanup = new Callbacks<undefined>();
    shared.callbacks.add(handleAudioChanged);
    handleAudioChanged();
    return () => {
      shared.callbacks.remove(handleAudioChanged);
      cleanup.call(undefined);
      cleanup.clear();
    };

    function handleAudioTime(audio: HTMLAudioElement): () => void {
      const onTimeUpdate = () => {
        setCurrentTime(audio.currentTime);
      };

      onTimeUpdate();
      audio.addEventListener('timeupdate', onTimeUpdate);
      return () => {
        audio.removeEventListener('timeupdate', onTimeUpdate);
      };
    }

    function handleAudioEnded(audio: HTMLAudioElement): () => void {
      const handler = () => {
        setScreen('feedback', false);
      };

      if (audio.ended) {
        handler();
        return () => {};
      }

      audio.addEventListener('ended', handler);
      return () => {
        audio.removeEventListener('ended', handler);
      };
    }

    function handleControls(audio: HTMLAudioElement): () => void {
      if (audio.paused) {
        setControlsVisibility('visible');
        return () => {};
      }

      let timeout: NodeJS.Timeout | null = null;
      const doHide = () => {
        setControlsVisibility('hiding');
        timeout = setTimeout(() => {
          timeout = null;
          setControlsVisibility('hidden');
        }, HIDING_TIME);
      };
      timeout = setTimeout(doHide, HIDE_TIME);

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
    }

    function handleAudioChanged() {
      cleanup.call(undefined);
      cleanup.clear();

      const audio = shared.get().audio.audio;
      if (audio !== null) {
        cleanup.add(handleAudioTime(audio));
        cleanup.add(handleAudioEnded(audio));
        cleanup.add(handleControls(audio));
      }
    }
  }, [shared, setScreen]);

  useFavoritedModal(showLikedUntil);
  useUnfavoritedModal(showUnlikedUntil);

  const onClickedClose = useCallback(() => {
    shared.get().audio.stop?.();

    if (onCloseEarly !== undefined) {
      onCloseEarly(currentTime, journey.durationSeconds);
    } else {
      setScreen('feedback', true);
    }
  }, [setScreen, shared, currentTime, journey.durationSeconds, onCloseEarly]);

  const audioProgressStyle = useMemo(() => {
    return {
      width: `${(currentTime / journey.durationSeconds) * 100}%`,
    };
  }, [currentTime, journey.durationSeconds]);

  const onToggleFavorited = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      const favorited = shared.get().favorited;
      if (favorited === null) {
        return;
      }

      e.preventDefault();
      setShowLikedUntil(undefined);
      setShowUnlikedUntil(undefined);
      setLikeError(null);

      try {
        const response = await apiFetch(
          '/api/1/users/me/journeys/likes' +
            (favorited ? '?uid=' + encodeURIComponent(journey.uid) : ''),
          favorited
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

        const nowFavorited = !favorited;
        shared.get().setFavorited(nowFavorited);
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
    [shared, journey.uid, loginContext]
  );

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.backgroundImageContainer}>
        <OsehImageFromStateValueWithCallbacks
          state={useMappedValueWithCallbacks(shared, (s) => s.darkenedImage)}
        />
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
          <RenderGuardedComponent
            props={shared}
            component={(s) => (
              <>
                {s.favorited !== null && (
                  <div className={styles.likeContainer}>
                    <IconButton
                      icon={s.favorited ? styles.fullHeartIcon : styles.emptyHeartIcon}
                      srOnlyName={s.favorited ? 'Unlike' : 'Like'}
                      onClick={onToggleFavorited}
                      disabled={false}
                    />
                  </div>
                )}
              </>
            )}
          />
          {likeError && <ErrorBlock>{likeError}</ErrorBlock>}
        </div>
      </div>
    </div>
  );
};
