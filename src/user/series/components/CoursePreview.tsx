import { thumbHashToAverageRGBA } from 'thumbhash';
import { IconButton } from '../../../shared/forms/IconButton';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { useWindowSizeValueWithCallbacks } from '../../../shared/hooks/useWindowSize';
import { OsehImageFromStateValueWithCallbacks } from '../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { OsehImagePropsLoadable } from '../../../shared/images/OsehImageProps';
import { areOsehImageStatesEqual } from '../../../shared/images/OsehImageState';
import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { useOsehImageStateValueWithCallbacks } from '../../../shared/images/useOsehImageStateValueWithCallbacks';
import { useStaleOsehImageOnSwap } from '../../../shared/images/useStaleOsehImageOnSwap';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { base64URLToByteArray } from '../../../shared/lib/colorUtils';
import { ExternalCoursePreviewable } from '../lib/ExternalCourse';
import styles from './CoursePreview.module.css';
import { useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { useValuesWithCallbacksEffect } from '../../../shared/hooks/useValuesWithCallbacksEffect';
import { setVWC } from '../../../shared/lib/setVWC';
import { useMappedValuesWithCallbacks } from '../../../shared/hooks/useMappedValuesWithCallbacks';
import { createVideoSizeComparerForTarget } from '../../../shared/content/createVideoSizeComparerForTarget';
import { useOsehContentTargetValueWithCallbacks } from '../../../shared/content/useOsehContentTargetValueWithCallbacks';
import { useReactManagedValueAsValueWithCallbacks } from '../../../shared/hooks/useReactManagedValueAsValueWithCallbacks';
import { useOsehVideoContentState } from '../../../shared/content/useOsehVideoContentState';
import { ReactElement, useCallback, useContext } from 'react';
import { useErrorModal } from '../../../shared/hooks/useErrorModal';
import { ModalContext } from '../../../shared/contexts/ModalContext';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { InlineOsehSpinner } from '../../../shared/components/InlineOsehSpinner';
import { combineClasses } from '../../../shared/lib/combineClasses';
import { useCurrentTranscriptPhrases } from '../../../shared/transcripts/useCurrentTranscriptPhrases';
import { TranscriptContainer } from '../../../shared/transcripts/TranscriptContainer';
import { Button } from '../../../shared/forms/Button';

export type CoursePreviewProps = {
  course: ExternalCoursePreviewable;
  onViewDetails: () => void;
  onBack: () => void;
  imageHandler: OsehImageStateRequestHandler;
};

/**
 * Displays the given course preview at full width/height, with a button
 * to view details or go back
 */
export const CoursePreview = ({
  course,
  onViewDetails,
  onBack,
  imageHandler,
}: CoursePreviewProps) => {
  const modalContext = useContext(ModalContext);
  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const coverImageProps = useMappedValueWithCallbacks(
    windowSizeVWC,
    (size): OsehImagePropsLoadable => ({
      uid: course.introVideoThumbnail.uid,
      jwt: course.introVideoThumbnail.jwt,
      displayWidth: size.width,
      displayHeight: size.height,
      alt: '',
    })
  );
  const coverImageState = useMappedValueWithCallbacks(
    useStaleOsehImageOnSwap(
      useOsehImageStateValueWithCallbacks(
        adaptValueWithCallbacksAsVariableStrategyProps(coverImageProps),
        imageHandler
      )
    ),
    (state) => {
      if (state.thumbhash === null && course.introVideoThumbhash !== null) {
        return { ...state, thumbhash: course.introVideoThumbhash };
      }
      return state;
    },
    {
      outputEqualityFn: areOsehImageStatesEqual,
    }
  );

  const coverAvgColor = useMappedValueWithCallbacks(
    coverImageState,
    (state) => {
      if (state.thumbhash === null) {
        return { r: 0, g: 0, b: 0, a: 1 };
      }

      return thumbHashToAverageRGBA(base64URLToByteArray(state.thumbhash));
    },
    {
      outputEqualityFn: (a, b) => a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a,
    }
  );

  const invertOverlayVWC = useMappedValueWithCallbacks(coverAvgColor, (color) => {
    const avg = (color.r + color.g + color.b) / 3;
    return avg < 128;
  });

  const contentRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  useValuesWithCallbacksEffect([invertOverlayVWC, contentRef], () => {
    const invertOverlay = invertOverlayVWC.get();
    const ele = contentRef.get();
    if (ele === null) {
      return;
    }

    if (invertOverlay) {
      ele.classList.add(styles.invertOverlay);
    } else {
      ele.classList.remove(styles.invertOverlay);
    }
    return undefined;
  });

  const videoTargetRefVWC = useReactManagedValueAsValueWithCallbacks(course.introVideo);
  const videoComparerVWC = useMappedValueWithCallbacks(windowSizeVWC, (size) =>
    createVideoSizeComparerForTarget(size.width, size.height)
  );
  const videoTargetVWC = useOsehContentTargetValueWithCallbacks({
    ref: videoTargetRefVWC,
    comparer: videoComparerVWC,
    presign: true,
  });
  const videoVWC = useOsehVideoContentState({ target: videoTargetVWC, size: windowSizeVWC });
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

  const videoErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(
    () => videoVWC.get().error
  );

  useValueWithCallbacksEffect(videoVWC, (v) => {
    setVWC(videoErrorVWC, v.error);
    return undefined;
  });

  useErrorModal(modalContext.modals, videoErrorVWC, 'loading video');

  const videoLoadedVWC = useMappedValueWithCallbacks(videoVWC, (v) => v.loaded);
  const videoPlayingVWC = useWritableValueWithCallbacks(() => false);
  const videoMutedVWC = useWritableValueWithCallbacks(() => false);
  const videoCurrentTimeVWC = useWritableValueWithCallbacks(() => 0);

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
        vid.addEventListener('ended', handlePausedChanged);
        vid.addEventListener('volumechange', handleMutedChanged);
        vid.addEventListener('timeupdate', handleTimeChanged);
        handlePausedChanged();
        handleMutedChanged();
        return () => {
          vid.removeEventListener('play', handlePausedChanged);
          vid.removeEventListener('pause', handlePausedChanged);
          vid.removeEventListener('ended', handlePausedChanged);
          vid.removeEventListener('volumechange', handleMutedChanged);
          vid.removeEventListener('timeupdate', handleTimeChanged);
        };

        function handlePausedChanged() {
          setVWC(videoPlayingVWC, !vid.paused && !vid.ended);
        }

        function handleMutedChanged() {
          setVWC(videoMutedVWC, vid.muted);
        }

        function handleTimeChanged() {
          setVWC(videoCurrentTimeVWC, vid.currentTime);
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

  const currentTranscriptPhrasesVWC = useCurrentTranscriptPhrases({
    transcriptRef: useReactManagedValueAsValueWithCallbacks(course.introVideoTranscript),
    currentTime: videoCurrentTimeVWC,
  });
  const closedCaptioningPhrasesVWC = useMappedValueWithCallbacks(
    currentTranscriptPhrasesVWC,
    (v) => v.phrases
  );
  const closedCaptioningAvailableVWC = useMappedValueWithCallbacks(
    currentTranscriptPhrasesVWC,
    useCallback(
      (v) => {
        return course.introVideoTranscript !== null && v.error === null;
      },
      [course]
    )
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

  const totalTime = ((durationSeconds) => {
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = Math.floor(durationSeconds % 60);

    return `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
  })(course.introVideoDuration);

  const progressFullRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  useValuesWithCallbacksEffect(
    [progressFullRef, videoCurrentTimeVWC],
    useCallback(() => {
      const ele = progressFullRef.get();
      if (ele === null) {
        return undefined;
      }

      const currentTime = videoCurrentTimeVWC.get();
      const progress = currentTime / course.introVideoDuration;
      ele.style.width = `${progress * 100}%`;
      return undefined;
    }, [progressFullRef, videoCurrentTimeVWC, course.introVideoDuration])
  );

  const onProgressContainerClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();

      const content = videoVWC.get();
      if (content.video === null) {
        return;
      }

      const location = e.clientX;
      const clickedButton = e.currentTarget;
      const clickedButtonRects = clickedButton.getBoundingClientRect();
      const progress = (location - clickedButtonRects.left) / clickedButtonRects.width;
      const seekingTo = progress * content.video.duration;
      content.video.currentTime = seekingTo;
    },
    [videoVWC]
  );

  return (
    <div className={styles.container}>
      <div className={styles.background} ref={(v) => setVWC(videoSinkVWC, v)}>
        <RenderGuardedComponent
          props={videoLoadedVWC}
          component={(loaded) =>
            !loaded ? <OsehImageFromStateValueWithCallbacks state={coverImageState} /> : <></>
          }
        />
      </div>
      <div className={styles.backgroundOverlay} />
      <div className={styles.content} ref={(v) => setVWC(contentRef, v)}>
        <div className={styles.closeButtonContainer}>
          <div className={styles.closeButtonInnerContainer}>
            <IconButton
              icon={styles.closeIcon}
              srOnlyName="Close"
              onClick={(e) => {
                e.preventDefault();
                onBack();
              }}
            />
          </div>
        </div>
        <div className={styles.pausePlayControlContainer}>
          <RenderGuardedComponent
            props={videoPlayPauseStateVWC}
            component={(state) =>
              state === 'loading' ? (
                <div
                  className={combineClasses(
                    styles.pausePlayControl,
                    styles.pausePlayControlLoading
                  )}>
                  <InlineOsehSpinner
                    size={{
                      type: 'react-rerender',
                      props: {
                        width: 25,
                      },
                    }}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className={combineClasses(styles.pausePlayControl, styles.pausePlayControlLoaded)}
                  onClick={(e) => {
                    e.preventDefault();
                    const vid = videoVWC.get();
                    if (vid.state !== 'loaded') {
                      return;
                    }

                    if (state === 'playing') {
                      vid.stop();
                    } else {
                      vid.play();
                    }
                  }}>
                  <div className={state === 'playing' ? styles.pauseIcon : styles.playIcon} />
                </button>
              )
            }
          />
        </div>
        <div className={styles.footer}>
          <div className={styles.footerInnerContainer}>
            <RenderGuardedComponent
              props={closedCaptioningStateVWC}
              component={(state) =>
                !state.enabled || !state.available ? (
                  <></>
                ) : (
                  <div className={styles.transcript}>
                    <TranscriptContainer
                      currentTime={videoCurrentTimeVWC}
                      currentTranscriptPhrases={closedCaptioningPhrasesVWC}
                    />
                  </div>
                )
              }
            />
            <div className={styles.infoAndActions}>
              <div className={styles.info}>
                <div className={styles.instructor}>{course.instructor.name}</div>
                <div className={styles.title}>{course.title}</div>
                <div className={styles.numClasses}>
                  {course.numJourneys.toLocaleString()} Classes
                </div>
              </div>
              <div className={styles.actions}>
                <div className={styles.actionIconsRow}>
                  <RenderGuardedComponent
                    props={videoMutedVWC}
                    component={(muted) => (
                      <IconButton
                        icon={muted ? styles.mutedIcon : styles.unmutedIcon}
                        srOnlyName={muted ? 'Unmute' : 'Mute'}
                        onClick={(e) => {
                          e.preventDefault();
                          const vid = videoVWC.get();
                          if (vid.state !== 'loaded') {
                            return;
                          }
                          vid.video.muted = !muted;
                        }}
                      />
                    )}
                  />
                  <RenderGuardedComponent
                    props={closedCaptioningStateVWC}
                    component={(state) =>
                      !state.available ? (
                        <></>
                      ) : (
                        <IconButton
                          icon={state.enabled ? styles.ccEnabledIcon : styles.ccDisabledIcon}
                          srOnlyName={
                            state.enabled ? 'Disable closed captioning' : 'Enable closed captioning'
                          }
                          onClick={(e) => {
                            e.preventDefault();
                            setVWC(closedCaptioningEnabledVWC, !state.enabled);
                          }}
                        />
                      )
                    }
                  />
                </div>
                <div className={styles.actionIconsRow}>
                  <Button
                    type="button"
                    variant="outlined-white-thin"
                    onClick={(e) => {
                      e.preventDefault();
                      onViewDetails();
                    }}>
                    <div className={styles.viewDetailsContent}>
                      View Series
                      <div className={styles.arrow} />
                    </div>
                  </Button>
                </div>
              </div>
            </div>
            <button
              className={styles.progressContainer}
              type="button"
              onClick={onProgressContainerClick}>
              <div
                className={styles.progressFull}
                style={{ width: '0' }}
                ref={(v) => setVWC(progressFullRef, v)}
              />
              <div className={styles.progressDot} />
              <div className={styles.progressEmpty} />
            </button>
            <div className={styles.durationContainer}>
              <div className={styles.currentTime}>
                <RenderGuardedComponent
                  props={videoCurrentTimeVWC}
                  component={(inFractionalSeconds) => {
                    const inSeconds = Math.floor(inFractionalSeconds);
                    const minutes = Math.floor(inSeconds / 60);
                    const seconds = Math.floor(inSeconds) % 60;

                    return (
                      <>
                        {minutes}:{seconds < 10 ? '0' : ''}
                        {seconds}
                      </>
                    );
                  }}
                />
              </div>
              <div className={styles.totalTime}>{totalTime}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
