import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { useWindowSizeValueWithCallbacks } from '../../../shared/hooks/useWindowSize';
import { OsehImageFromStateValueWithCallbacks } from '../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { OsehImagePropsLoadable } from '../../../shared/images/OsehImageProps';
import { areOsehImageStatesEqual } from '../../../shared/images/OsehImageState';
import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { useOsehImageStateValueWithCallbacks } from '../../../shared/images/useOsehImageStateValueWithCallbacks';
import { useStaleOsehImageOnSwap } from '../../../shared/images/useStaleOsehImageOnSwap';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { ExternalCoursePreviewable } from '../lib/ExternalCourse';
import styles from './CoursePreview.module.css';
import { useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { useValuesWithCallbacksEffect } from '../../../shared/hooks/useValuesWithCallbacksEffect';
import { setVWC } from '../../../shared/lib/setVWC';
import { createVideoSizeComparerForTarget } from '../../../shared/content/createVideoSizeComparerForTarget';
import { useOsehContentTargetValueWithCallbacks } from '../../../shared/content/useOsehContentTargetValueWithCallbacks';
import { useReactManagedValueAsValueWithCallbacks } from '../../../shared/hooks/useReactManagedValueAsValueWithCallbacks';
import { useOsehVideoContentState } from '../../../shared/content/useOsehVideoContentState';
import { ReactElement, useCallback, useContext } from 'react';
import { useErrorModal } from '../../../shared/hooks/useErrorModal';
import { ModalContext } from '../../../shared/contexts/ModalContext';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { useCurrentTranscriptPhrases } from '../../../shared/transcripts/useCurrentTranscriptPhrases';
import { useMediaInfo } from '../../../shared/content/useMediaInfo';
import { PlayerCTA, PlayerForeground } from '../../../shared/content/player/PlayerForeground';
import {
  StandardScreenTransitionProp,
  useStandardTransitionsState,
} from '../../../shared/hooks/useStandardTransitions';
import { useInitializedTransitionProp } from '../../../shared/lib/TransitionProp';
import { OpacityTransitionOverlay } from '../../../shared/components/OpacityTransitionOverlay';
import { WipeTransitionOverlay } from '../../../shared/components/WipeTransitionOverlay';
import { useMappedValuesWithCallbacks } from '../../../shared/hooks/useMappedValuesWithCallbacks';

export type CoursePreviewProps = {
  course: ExternalCoursePreviewable;
  onViewDetails: () => Promise<void>;
  onBack: () => Promise<void>;
  imageHandler: OsehImageStateRequestHandler;
  transition?: StandardScreenTransitionProp;
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
  transition: transitionRaw,
}: CoursePreviewProps) => {
  const transition = useInitializedTransitionProp(transitionRaw, () => ({
    type: 'none',
    ms: 0,
  }));
  const transitionState = useStandardTransitionsState(transition);

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

      const vid = video.element;
      sink.insertAdjacentElement('afterbegin', vid);
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

  const transcript = useCurrentTranscriptPhrases({
    transcriptRef: useReactManagedValueAsValueWithCallbacks(course.introVideoTranscript),
  });

  const videoInfo = useMediaInfo({
    mediaVWC: videoVWC,
    currentTranscriptPhrasesVWC: transcript,
    durationSeconds: course.introVideoDuration,
  });

  const title = useReactManagedValueAsValueWithCallbacks(course.title);
  const subtitle = useReactManagedValueAsValueWithCallbacks(course.instructor.name);
  const tag = useReactManagedValueAsValueWithCallbacks(
    `${course.numJourneys.toLocaleString()} Classes`
  );
  const onClose = useReactManagedValueAsValueWithCallbacks(onBack);
  const cta = useReactManagedValueAsValueWithCallbacks<PlayerCTA>({
    title: 'View Series',
    action: onViewDetails,
  });

  return (
    <div className={styles.container}>
      <div className={styles.background} ref={(v) => setVWC(videoSinkVWC, v)}>
        <RenderGuardedComponent
          props={useMappedValuesWithCallbacks(
            [videoInfo.loaded, videoInfo.playing, videoInfo.currentTime],
            () =>
              !videoInfo.loaded.get() ||
              (!videoInfo.playing.get() && videoInfo.currentTime.get() === 0)
          )}
          component={(loaded) =>
            !loaded ? <OsehImageFromStateValueWithCallbacks state={coverImageState} /> : <></>
          }
        />
      </div>
      <div className={styles.backgroundOverlay} />
      <div className={styles.content}>
        <PlayerForeground
          size={windowSizeVWC}
          content={videoVWC}
          mediaInfo={videoInfo}
          transcript={transcript}
          title={title}
          subtitle={subtitle}
          tag={tag}
          onClose={onClose}
          cta={cta}
        />
      </div>
      <OpacityTransitionOverlay opacity={transitionState.opacity} />
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </div>
  );
};
