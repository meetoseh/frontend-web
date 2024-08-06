import { ReactElement } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import styles from './ChooseAFeeling.module.css';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { ChooseAFeelingResources } from './ChooseAFeelingResources';
import { ChooseAFeelingMappedParams } from './ChooseAFeelingParams';
import { EmotionsPicker } from '../home/components/EmotionsPicker';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { ContentContainer } from '../../../../shared/components/ContentContainer';
import { trackClassTaken } from '../home/lib/trackClassTaken';
import { configurableScreenOut } from '../../lib/configurableScreenOut';

/**
 * A basic screen where the user can choose an emotion
 */
export const ChooseAFeeling = ({
  ctx,
  screen,
  resources,
  startPop,
}: ScreenComponentProps<
  'choose_a_feeling',
  ChooseAFeelingResources,
  ChooseAFeelingMappedParams
>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);
  const windowWidthVWC = useMappedValueWithCallbacks(ctx.windowSizeImmediate, (s) => s.width);

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        contentWidthVWC={windowWidthVWC}
        left={transitionState.left}
        opacity={transitionState.opacity}
        gridSizeVWC={ctx.windowSizeImmediate}
        justifyContent="flex-start">
        <VerticalSpacer height={32} />
        <ContentContainer contentWidthVWC={ctx.contentWidth} justifyContent="flex-start">
          <div className={styles.top}>{screen.parameters.top}</div>
        </ContentContainer>
        <VerticalSpacer height={0} flexGrow={3} />
        <ContentContainer contentWidthVWC={ctx.contentWidth} justifyContent="flex-start">
          <div className={styles.header}>{screen.parameters.header}</div>
        </ContentContainer>
        {screen.parameters.message === null ? null : (
          <>
            <VerticalSpacer height={16} />
            <ContentContainer contentWidthVWC={ctx.contentWidth} justifyContent="flex-start">
              <div className={styles.message}>{screen.parameters.message}</div>
            </ContentContainer>
          </>
        )}
        <VerticalSpacer height={0} flexGrow={1} />
        <EmotionsPicker
          emotions={resources.emotions}
          question={null}
          onTapEmotion={(emotion) => {
            configurableScreenOut(
              workingVWC,
              startPop,
              transition,
              screen.parameters.exit,
              screen.parameters.trigger,
              {
                endpoint: screen.parameters.direct
                  ? '/api/1/users/me/screens/pop_to_emotion_class'
                  : undefined,
                parameters: Object.assign(
                  { emotion: emotion.word },
                  screen.parameters.direct ? { premium: screen.parameters.premium } : undefined
                ),
                afterDone: screen.parameters.direct
                  ? async () => {
                      trackClassTaken(ctx);
                    }
                  : undefined,
              }
            );
          }}
          expectedHeight={useMappedValueWithCallbacks(
            ctx.windowSizeImmediate,
            () =>
              ctx.windowSizeImmediate.get().height -
              32 /* top padding*/ -
              24 /* top height, expected */ -
              29 /* title height, expected */ -
              16 /* title to message */ -
              48 /* message height, expected */
          )}
          contentWidth={windowWidthVWC}
        />
        <VerticalSpacer height={0} flexGrow={3} />
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
