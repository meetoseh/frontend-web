import { ReactElement } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import {
  ValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { PlayerCTA, PlayerForeground } from '../../../../shared/content/player/PlayerForeground';
import { useCurrentTranscriptPhrases } from '../../../../shared/transcripts/useCurrentTranscriptPhrases';
import { useReactManagedValueAsValueWithCallbacks } from '../../../../shared/hooks/useReactManagedValueAsValueWithCallbacks';
import { useMediaInfo } from '../../../../shared/content/useMediaInfo';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { AudioInterstitialResources } from './AudioInterstitialResources';
import { AudioInterstitialMappedParams } from './AudioInterstitialParams';
import { GridImageBackground } from '../../../../shared/components/GridImageBackground';
import { configurableScreenOut } from '../../lib/configurableScreenOut';

/**
 * A basic audio interstitial
 */
export const AudioInterstitial = ({
  ctx,
  screen,
  resources,
  trace,
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
    transcript: resources.transcript,
  });
  const mediaInfo = useMediaInfo({
    mediaVWC: audioVWC,
    currentTranscriptPhrasesVWC: transcript,
  });

  const onFinish = () => {
    configurableScreenOut(
      workingVWC,
      startPop,
      transition,
      screen.parameters.exit,
      screen.parameters.trigger
    );
  };

  useValueWithCallbacksEffect(mediaInfo.ended, (ended) => {
    if (ended) {
      trace({ type: 'ended', time: mediaInfo.currentTime.get() });
      onFinish();
    }
    return undefined;
  });

  const cta = useReactManagedValueAsValueWithCallbacks<PlayerCTA>({
    title: screen.parameters.cta ?? 'Skip',
    action: async () => {
      trace({ type: 'skip', time: mediaInfo.currentTime.get() });
      onFinish();
    },
  });
  const title = useReactManagedValueAsValueWithCallbacks(screen.parameters.title);
  const subtitle = useReactManagedValueAsValueWithCallbacks(screen.parameters.subtitle);

  useValueWithCallbacksEffect(mediaInfo.paused, (paused) => {
    trace({ type: 'paused-changed', paused, time: mediaInfo.currentTime.get() });
    return undefined;
  });

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
          subtitle={
            screen.parameters.subtitle === null
              ? undefined
              : (subtitle as ValueWithCallbacks<string>)
          }
          cta={screen.parameters.cta === null ? undefined : cta}
          onClose={
            !screen.parameters.close
              ? undefined
              : createWritableValueWithCallbacks(async () => {
                  trace({ type: 'close-via-x', time: mediaInfo.currentTime.get() });
                  onFinish();
                })
          }
          assumeDark={screen.parameters.dark}
        />
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
