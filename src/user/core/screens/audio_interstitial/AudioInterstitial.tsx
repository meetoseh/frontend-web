import { ReactElement } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
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
import { useCurrentTranscriptPhrases } from '../../../../shared/transcripts/useCurrentTranscriptPhrases';
import { useReactManagedValueAsValueWithCallbacks } from '../../../../shared/hooks/useReactManagedValueAsValueWithCallbacks';
import { useMediaInfo } from '../../../../shared/content/useMediaInfo';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { AudioInterstitialResources } from './AudioInterstitialResources';
import { AudioInterstitialMappedParams } from './AudioInterstitialParams';
import { GridImageBackground } from '../../../../shared/components/GridImageBackground';

/**
 * A basic audio interstitial
 */
export const AudioInterstitial = ({
  ctx,
  screen,
  resources,
  startPop,
}: ScreenComponentProps<
  'audio_interstitial',
  AudioInterstitialResources,
  AudioInterstitialMappedParams
>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const windowWidthVWC = useMappedValueWithCallbacks(ctx.windowSizeImmediate, (v) => v.width);
  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  const audioVWC = resources.audio;
  const transcript = useCurrentTranscriptPhrases({
    transcriptRef: useReactManagedValueAsValueWithCallbacks(screen.parameters.audio.transcript),
  });
  const mediaInfo = useMediaInfo({
    mediaVWC: audioVWC,
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
      <GridImageBackground
        image={resources.background}
        thumbhash={useReactManagedValueAsValueWithCallbacks(
          screen.parameters.background?.thumbhash ?? null
        )}
      />
      <GridContentContainer
        contentWidthVWC={windowWidthVWC}
        left={transitionState.left}
        opacity={transitionState.opacity}
        gridSizeVWC={ctx.windowSizeImmediate}>
        <PlayerForeground
          size={ctx.windowSizeImmediate}
          content={audioVWC}
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
