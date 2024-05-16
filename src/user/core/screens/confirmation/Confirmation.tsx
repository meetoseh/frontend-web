import { ReactElement } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { ConfirmationMappedParams } from './ConfirmationParams';
import { ConfirmationResources } from './ConfirmationResources';
import { useContentWidthValueWithCallbacks } from '../../../../shared/lib/useContentWidthValueWithCallbacks';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import styles from './Confirmation.module.css';
import { Button } from '../../../../shared/forms/Button';
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
  const transition = useTransitionProp((): StandardScreenTransition => ({ type: 'fade', ms: 350 }));
  useEntranceTransition(transition);

  const contentWidthVWC = useContentWidthValueWithCallbacks(ctx.windowSizeImmediate);
  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        contentWidthVWC={contentWidthVWC}
        left={transitionState.left}
        opacity={transitionState.opacity}>
        <div className={styles.header}>{screen.parameters.header}</div>
        <div style={{ height: '16px' }} />
        <div className={styles.message}>{screen.parameters.message}</div>
        <div style={{ height: '24px' }} />
        <Button
          type="button"
          variant="filled-white"
          onClick={async (e) => {
            e.preventDefault();
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
            await playExitTransition(transition).promise;
            finishPop();
          }}>
          Ok
        </Button>
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
