import { ReactElement, useCallback, useEffect, useRef } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { WelcomeVideoResources } from './WelcomeVideoResources';
import { WelcomeVideoState } from './WelcomeVideoState';
import styles from './WelcomeVideo.module.css';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { useValuesWithCallbacksEffect } from '../../../../shared/hooks/useValuesWithCallbacksEffect';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useVideoInfo } from '../../../../shared/hooks/useVideoInfo';
import { useCurrentTranscriptPhrases } from '../../../../shared/transcripts/useCurrentTranscriptPhrases';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { OsehImageFromStateValueWithCallbacks } from '../../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { useAnimationTargetAndRendered } from '../../../../shared/anim/useAnimationTargetAndRendered';
import { BezierAnimator } from '../../../../shared/anim/AnimationLoop';
import { ease } from '../../../../shared/lib/Bezier';
import { InlineOsehSpinner } from '../../../../shared/components/InlineOsehSpinner';
import { TranscriptContainer } from '../../../../shared/transcripts/TranscriptContainer';
import { useStartSession } from '../../../../shared/hooks/useInappNotificationSession';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { Button } from '../../../../shared/forms/Button';

/**
 * Displays the full screen welcome video
 */
export const WelcomeVideo = ({
  state,
  resources,
}: FeatureComponentProps<WelcomeVideoState, WelcomeVideoResources>): ReactElement => {
  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  useStartSession(
    adaptValueWithCallbacksAsVariableStrategyProps(
      useMappedValueWithCallbacks(resources, (r) => r.session)
    ),
    {
      onStart: () => {
        const onboardingVideo = resources.get().onboardingVideo;
        resources.get().session?.storeAction('open', {
          onboarding_video_uid:
            onboardingVideo.type === 'success' ? onboardingVideo.result.onboardingVideoUid : null,
          content_file_uid:
            onboardingVideo.type === 'success' ? onboardingVideo.result.video.uid : null,
        });
      },
    }
  );

  const videoVWC = useMappedValueWithCallbacks(resources, (r) => r.video);
  const videoSinkVWC = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);

  useValuesWithCallbacksEffect([windowSizeVWC, videoSinkVWC], () => {
    const size = windowSizeVWC.get();
    const sink = videoSinkVWC.get();

    if (sink === null) {
      return undefined;
    }

    sink.style.width = `${size.width}px`;
    sink.style.height = `${size.height}px`;
    return undefined;
  });

  useValuesWithCallbacksEffect(
    [videoVWC, videoSinkVWC],
    useCallback(() => {
      const video = videoVWC.get();
      const sink = videoSinkVWC.get();

      if (video.state !== 'loaded' || sink === null) {
        return undefined;
      }

      const vid = video.video;
      sink.appendChild(vid);
      return () => {
        vid.remove();
      };
    }, [videoSinkVWC, videoVWC])
  );

  const videoInfo = useVideoInfo({
    videoVWC: videoVWC,
    currentTranscriptPhrasesVWC: useCurrentTranscriptPhrases({
      transcriptRef: useMappedValueWithCallbacks(resources, (r) => {
        if (r.onboardingVideo.type !== 'success') {
          return null;
        }
        return r.onboardingVideo.result.transcript;
      }),
    }),
  });

  const coverImageStateVWC = useMappedValueWithCallbacks(resources, (r) => r.coverImage);
  const overlayVWC = useAnimationTargetAndRendered<{ opacity: number }>(
    () => ({ opacity: 1 }),
    () => [
      new BezierAnimator(
        ease,
        350,
        (p) => p.opacity,
        (p, v) => (p.opacity = v)
      ),
    ]
  );

  const overlayRef = useWritableValueWithCallbacks<HTMLButtonElement | null>(() => null);
  useValuesWithCallbacksEffect([overlayRef, overlayVWC.rendered], () => {
    const ele = overlayRef.get();
    const { opacity } = overlayVWC.rendered.get();
    if (ele !== null) {
      ele.style.backgroundColor = `rgba(0, 0, 0, ${opacity * 0.5})`;
      ele.style.opacity = `${opacity}`;
    }
    return undefined;
  });

  useMappedValueWithCallbacks(videoInfo.playing, (playing) => {
    setVWC(overlayVWC.target, { opacity: playing ? 0 : 1 });
    return undefined;
  });

  const contentRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  useValuesWithCallbacksEffect([contentRef, overlayVWC.rendered], () => {
    const ele = contentRef.get();
    const { opacity } = overlayVWC.rendered.get();
    if (ele !== null) {
      ele.style.opacity = `${1 - opacity}`;
    }
    return undefined;
  });

  const reportedPlayingRef = useRef<boolean>(false);
  useValueWithCallbacksEffect(videoInfo.playing, (playing) => {
    if (playing === reportedPlayingRef.current) {
      return undefined;
    }
    reportedPlayingRef.current = playing;
    if (playing) {
      resources.get().session?.storeAction('play', null);
    } else {
      if (!videoInfo.ended.get()) {
        resources.get().session?.storeAction('pause', { time: videoInfo.currentTime.get() });
      }
    }
    return undefined;
  });

  useValueWithCallbacksEffect(
    videoInfo.ended,
    useCallback(
      (ended) => {
        if (ended) {
          resources.get().session?.storeAction('ended', null);
          resources.get().session?.reset();
          state.get().ian?.onShown();
        }
        return undefined;
      },
      [resources, state]
    )
  );

  useEffect(() => {
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };

    function onBeforeUnload() {
      resources.get().session?.storeAction('close', null);
    }
  });

  // TODO -> welcome video controls

  return (
    <div className={styles.container}>
      <div className={styles.background} ref={(v) => setVWC(videoSinkVWC, v)}>
        <RenderGuardedComponent
          props={videoInfo.loaded}
          component={(loaded) =>
            !loaded ? <OsehImageFromStateValueWithCallbacks state={coverImageStateVWC} /> : <></>
          }
        />
      </div>
      <div
        className={styles.content}
        ref={(v) => setVWC(contentRef, v)}
        style={{ opacity: `${1 - overlayVWC.rendered.get().opacity}` }}>
        <RenderGuardedComponent
          props={videoInfo.closedCaptioning.state}
          component={(state) =>
            !state.enabled || !state.available ? (
              <></>
            ) : (
              <div className={styles.transcript}>
                <TranscriptContainer
                  currentTime={videoInfo.currentTime}
                  currentTranscriptPhrases={videoInfo.closedCaptioning.phrases}
                />
              </div>
            )
          }
        />
      </div>
      <button
        className={styles.overlay}
        ref={(r) => setVWC(overlayRef, r)}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          const vid = videoVWC.get();
          if (videoInfo.loaded.get() && vid.loaded) {
            const wasPlaying = videoInfo.playing.get();
            if (wasPlaying) {
              vid.stop();
            } else {
              vid.play();
            }
          }
        }}
        style={{
          backgroundColor: `rgba(0, 0, 0, ${overlayVWC.rendered.get().opacity * 0.5})`,
          opacity: overlayVWC.rendered.get().opacity,
        }}>
        <div className={styles.overlayContent}>
          <RenderGuardedComponent
            props={videoInfo.loaded}
            component={(loaded) =>
              loaded ? (
                <>Press anywhere to play</>
              ) : (
                <InlineOsehSpinner
                  size={{
                    type: 'react-rerender',
                    props: {
                      width: 60,
                    },
                  }}
                />
              )
            }
          />
          <div className={styles.skipButton}>
            <Button
              type="button"
              variant="outlined-white"
              onClick={() => {
                resources.get().session?.storeAction('close', null);
                resources.get().session?.reset();
                state.get().ian?.onShown();
              }}
              fullWidth>
              Skip
            </Button>
          </div>
        </div>
      </button>
    </div>
  );
};
