import { ReactElement, useCallback } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import styles from './VideoInterstitial.module.css';
import {
  playExitTransition,
  useEntranceTransition,
  useTransitionProp,
} from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { PlayerCTA, PlayerForeground } from '../../../../shared/content/player/PlayerForeground';
import { VideoInterstitialResources } from './VideoInterstitialResources';
import { VideoInterstitialMappedParams } from './VideoInterstitialParams';
import { useValuesWithCallbacksEffect } from '../../../../shared/hooks/useValuesWithCallbacksEffect';
import { useCurrentTranscriptPhrases } from '../../../../shared/transcripts/useCurrentTranscriptPhrases';
import { useReactManagedValueAsValueWithCallbacks } from '../../../../shared/hooks/useReactManagedValueAsValueWithCallbacks';
import { useMediaInfo } from '../../../../shared/content/useMediaInfo';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { getEffectiveVideoTarget } from '../../../../shared/content/createVideoSizeComparerForTarget';
import { largestPhysicalPerLogical } from '../../../../shared/images/DisplayRatioHelper';

/**
 * A basic full screen video interstitial
 */
export const VideoInterstitial = ({
  ctx,
  screen,
  resources,
  startPop,
}: ScreenComponentProps<
  'video_interstitial',
  VideoInterstitialResources,
  VideoInterstitialMappedParams
>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const windowWidthVWC = useMappedValueWithCallbacks(ctx.windowSizeImmediate, (v) => v.width);
  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  const videoVWC = resources.video;
  const videoSinkVWC = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);

  useValuesWithCallbacksEffect([ctx.windowSizeImmediate, videoSinkVWC], () => {
    const size = ctx.windowSizeImmediate.get();
    const sink = videoSinkVWC.get();

    if (sink === null) {
      return undefined;
    }

    sink.style.width = `${size.width}px`;
    sink.style.height = `${size.height}px`;
    return undefined;
  });

  useValuesWithCallbacksEffect([ctx.windowSizeImmediate, videoVWC], () => {
    const size = ctx.windowSizeImmediate.get();
    const vid = videoVWC.get();

    if (vid.state !== 'loaded') {
      return undefined;
    }

    if (vid.element.videoWidth <= 0 || vid.element.videoHeight <= 0) {
      return undefined;
    }

    const realWidth = vid.element.videoWidth;
    const realHeight = vid.element.videoHeight;

    const effective = getEffectiveVideoTarget(size, { width: realWidth, height: realHeight });
    const logicalWidth = (realWidth * effective.pixelPhysicalSize) / largestPhysicalPerLogical;
    const logicalHeight = (realHeight * effective.pixelPhysicalSize) / largestPhysicalPerLogical;

    vid.element.setAttribute('width', `${logicalWidth}`);
    vid.element.setAttribute('height', `${logicalHeight}`);
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
      sink.appendChild(vid);
      return () => {
        vid.remove();
      };
    }, [videoSinkVWC, videoVWC])
  );

  const transcript = useCurrentTranscriptPhrases({
    transcriptRef: useReactManagedValueAsValueWithCallbacks(screen.parameters.video.transcript),
  });
  const mediaInfo = useMediaInfo({
    mediaVWC: videoVWC,
    currentTranscriptPhrasesVWC: transcript,
  });

  const onFinish = () => {
    if (workingVWC.get()) {
      return;
    }

    setVWC(workingVWC, true);
    const finishPop = startPop(
      screen.parameters.trigger === null
        ? null
        : {
            slug: screen.parameters.trigger,
            parameters: {},
          }
    );
    setVWC(transition.animation, screen.parameters.exit);
    playExitTransition(transition).promise.finally(() => finishPop());
  };

  useValueWithCallbacksEffect(mediaInfo.ended, (ended) => {
    if (ended) {
      onFinish();
    }
    return undefined;
  });

  const cta = useReactManagedValueAsValueWithCallbacks<PlayerCTA>({
    title: screen.parameters.cta ?? 'Skip',
    action: async () => {
      onFinish();
    },
  });
  const title = useReactManagedValueAsValueWithCallbacks(screen.parameters.title);

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <div className={styles.background} ref={(v) => setVWC(videoSinkVWC, v)} />
      <GridContentContainer
        contentWidthVWC={windowWidthVWC}
        left={transitionState.left}
        opacity={transitionState.opacity}
        gridSizeVWC={ctx.windowSizeImmediate}>
        <PlayerForeground
          size={ctx.windowSizeImmediate}
          content={videoVWC}
          mediaInfo={mediaInfo}
          transcript={transcript}
          title={title}
          cta={cta}
        />
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
