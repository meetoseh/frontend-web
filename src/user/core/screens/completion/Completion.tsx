import { ReactElement } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import styles from './Completion.module.css';
import { Button } from '../../../../shared/forms/Button';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { CompletionResources } from './CompletionResources';
import { CompletionMappedParams } from './CompletionParams';
import { GridConfetti } from '../../../../shared/components/GridConfetti';
import HugeCheck from './icons/HugeCheck';
import { configurableScreenOut } from '../../lib/configurableScreenOut';

/**
 * A basic completion screen that shows some confetti and includes a call to action
 */
export const Completion = ({
  ctx,
  screen,
  startPop,
}: ScreenComponentProps<
  'completion',
  CompletionResources,
  CompletionMappedParams
>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        contentWidthVWC={ctx.contentWidth}
        left={transitionState.left}
        opacity={transitionState.opacity}
        gridSizeVWC={ctx.windowSizeImmediate}
        justifyContent="flex-start">
        <VerticalSpacer height={0} flexGrow={2} />
        <div className={styles.check}>
          <HugeCheck />
        </div>
        <VerticalSpacer height={0} flexGrow={1} />
        {screen.parameters.subtitle !== null && (
          <>
            <div className={styles.subtitle}>{screen.parameters.subtitle}</div>
            <VerticalSpacer height={16} />
          </>
        )}
        <div className={styles.title}>{screen.parameters.title}</div>
        <VerticalSpacer height={40} />
        <Button
          type="button"
          variant="filled-premium"
          onClick={async (e) => {
            e.preventDefault();
            configurableScreenOut(
              workingVWC,
              startPop,
              transition,
              screen.parameters.cta.exit,
              screen.parameters.cta.trigger
            );
          }}>
          {screen.parameters.cta.text}
        </Button>
        <VerticalSpacer height={32} />
      </GridContentContainer>
      <GridConfetti windowSizeImmediate={ctx.windowSizeImmediate} />
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
