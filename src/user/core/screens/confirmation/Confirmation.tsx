import { ReactElement } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { ConfirmationMappedParams } from './ConfirmationParams';
import { ConfirmationResources } from './ConfirmationResources';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import styles from './Confirmation.module.css';
import { Button } from '../../../../shared/forms/Button';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { screenOut } from '../../lib/screenOut';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';

/**
 * A basic confirmation screen with a header and message
 */
export const Confirmation = ({
  ctx,
  screen,
  startPop,
}: ScreenComponentProps<
  'confirmation',
  ConfirmationResources,
  ConfirmationMappedParams
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
        gridSizeVWC={ctx.windowSizeImmediate}>
        <div className={styles.header}>{screen.parameters.header}</div>
        <VerticalSpacer height={16} />
        <div className={styles.message}>{screen.parameters.message}</div>
        <VerticalSpacer height={24} />
        <Button
          type="button"
          variant="filled-white"
          onClick={async (e) => {
            e.preventDefault();
            screenOut(
              workingVWC,
              startPop,
              transition,
              screen.parameters.exit,
              screen.parameters.trigger
            );
          }}>
          {screen.parameters.cta}
        </Button>
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
