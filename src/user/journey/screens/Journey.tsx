import {
  PropsWithChildren,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
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
import {
  Callbacks,
  ValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { OsehImageFromStateValueWithCallbacks } from '../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { useWindowSizeValueWithCallbacks } from '../../../shared/hooks/useWindowSize';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { inferAnimators } from '../../../shared/anim/AnimationLoop';
import { ease } from '../../../shared/lib/Bezier';
import { useAnimatedValueWithCallbacks } from '../../../shared/anim/useAnimatedValueWithCallbacks';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';
import { setVWC } from '../../../shared/lib/setVWC';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';

const HIDE_TIME = 10000;

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
  const controlsVisible = useWritableValueWithCallbacks<boolean>(() => true);
  const currentTimeVWC = useWritableValueWithCallbacks<number>(() => 0);
  const showLikedUntilVWC = useWritableValueWithCallbacks<number | undefined>(() => undefined);
  const showUnlikedUntilVWC = useWritableValueWithCallbacks<number | undefined>(() => undefined);
  const likeErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const windowSizeVWC = useWindowSizeValueWithCallbacks();

  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSizeVWC });

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
        setVWC(currentTimeVWC, audio.currentTime);
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
        setVWC(controlsVisible, true);
        return () => {};
      }

      let timeout: NodeJS.Timeout | null = null;
      const doHide = () => {
        setVWC(controlsVisible, false);
      };
      timeout = setTimeout(doHide, HIDE_TIME);

      const onUserInput = () => {
        if (timeout !== null) {
          clearTimeout(timeout);
        }
        setVWC(controlsVisible, true);
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
  }, [shared, setScreen, controlsVisible, currentTimeVWC]);

  useFavoritedModal(adaptValueWithCallbacksAsVariableStrategyProps(showLikedUntilVWC));
  useUnfavoritedModal(adaptValueWithCallbacksAsVariableStrategyProps(showUnlikedUntilVWC));

  const onClickedClose = useCallback(() => {
    shared.get().audio.stop?.();

    if (onCloseEarly !== undefined) {
      onCloseEarly(currentTimeVWC.get(), journey.durationSeconds);
    } else {
      setScreen('feedback', true);
    }
  }, [setScreen, shared, currentTimeVWC, journey.durationSeconds, onCloseEarly]);

  const audioProgressRef = useRef<HTMLDivElement>(null);
  useValueWithCallbacksEffect(
    currentTimeVWC,
    useCallback(
      (currentTime) => {
        if (audioProgressRef.current === null) {
          return;
        }
        audioProgressRef.current.style.width = `${(currentTime / journey.durationSeconds) * 100}%`;
        return undefined;
      },
      [journey.durationSeconds]
    )
  );

  const onToggleFavorited = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      const favorited = shared.get().favorited;
      if (favorited === null) {
        return;
      }

      e.preventDefault();
      setVWC(showLikedUntilVWC, undefined);
      setVWC(showUnlikedUntilVWC, undefined);
      setVWC(likeErrorVWC, null);

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
          setVWC(showLikedUntilVWC, Date.now() + 5000);
        } else {
          setVWC(showUnlikedUntilVWC, Date.now() + 5000);
        }
      } catch (err) {
        const desc = await describeError(err);
        setVWC(likeErrorVWC, desc);
      }
    },
    [shared, journey.uid, loginContext, showLikedUntilVWC, showUnlikedUntilVWC, likeErrorVWC]
  );

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.backgroundImageContainer}>
        <OsehImageFromStateValueWithCallbacks
          state={useMappedValueWithCallbacks(shared, (s) => s.darkenedImage)}
        />
      </div>
      <Control
        className={`${styles.closeButtonContainer} ${styles.control}`}
        visible={controlsVisible}>
        <div className={styles.closeButtonInnerContainer}>
          <button type="button" className={styles.close} onClick={onClickedClose}>
            <div className={styles.closeIcon} />
            <div className={assistiveStyles.srOnly}>Close</div>
          </button>
        </div>
      </Control>
      <Control
        className={`${styles.audioControlsContainer} ${styles.control}`}
        visible={controlsVisible}>
        <div className={styles.audioControlsInnerContainer}>
          <div className={styles.audioProgressContainer}>
            <div className={styles.audioProgress} ref={audioProgressRef}></div>
            <div className={styles.audioProgressCircle}></div>
          </div>
        </div>
      </Control>
      <Control className={`${styles.innerContainer} ${styles.control}`} visible={controlsVisible}>
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
          <RenderGuardedComponent
            props={likeErrorVWC}
            component={(likeError) => <>{likeError && <ErrorBlock>{likeError}</ErrorBlock>}</>}
          />
        </div>
      </Control>
    </div>
  );
};

const Control = ({
  visible,
  className,
  children,
}: PropsWithChildren<{
  visible: ValueWithCallbacks<boolean>;
  className: string;
}>): ReactElement => {
  const animators = useMemo(
    () => inferAnimators<{ opacity: number }, { opacity: number }>({ opacity: 0 }, ease, 350),
    []
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const target = useAnimatedValueWithCallbacks({ opacity: 1 }, animators, (val) => {
    if (containerRef.current === null) {
      return;
    }
    const ele = containerRef.current;
    if (val.opacity <= 0) {
      ele.style.display = 'none';
      ele.style.removeProperty('opacity');
      return;
    }

    ele.style.removeProperty('display');
    ele.style.opacity = `${val.opacity * 100}%`;
  });

  useValueWithCallbacksEffect(
    visible,
    useCallback(
      (val) => {
        setVWC(target, { opacity: val ? 1 : 0 }, (a, b) => a.opacity === b.opacity);
        return undefined;
      },
      [target]
    )
  );

  return (
    <div className={className} ref={containerRef}>
      {children}
    </div>
  );
};
