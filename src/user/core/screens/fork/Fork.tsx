import { ReactElement } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import styles from './Fork.module.css';
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
import { ForkResources } from './ForkResources';
import { ForkMappedParams } from './ForkParams';
import { RightCaret } from './icons/RightCaret';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';

/**
 * A basic fork screen with a header, message, and a series of choices
 */
export const Fork = ({
  ctx,
  screen,
  startPop,
  trace,
}: ScreenComponentProps<'fork', ForkResources, ForkMappedParams>): ReactElement => {
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
        <VerticalSpacer height={0} flexGrow={1} />
        <div className={styles.header}>{screen.parameters.header}</div>
        <VerticalSpacer height={16} />
        <div className={styles.message}>{screen.parameters.message}</div>
        <VerticalSpacer height={32} />
        <div className={styles.options}>
          {screen.parameters.options.map((option, i) => (
            <button
              className={styles.option}
              key={i}
              onClick={async (e) => {
                e.preventDefault();
                if (workingVWC.get()) {
                  return;
                }

                setVWC(workingVWC, true);
                const finishPop = startPop(
                  option.trigger === null
                    ? null
                    : {
                        slug: option.trigger,
                        parameters: {},
                      }
                );
                setVWC(transition.animation, option.exit);
                const exitTransitionCancelable = playExitTransition(transition);
                try {
                  trace({
                    type: 'fork_option_selected',
                    option,
                  });
                } finally {
                  await exitTransitionCancelable.promise;
                  finishPop();
                }
              }}>
              <div className={styles.optionText}>{option.text}</div>
              <RightCaret />
            </button>
          ))}
        </div>
        <VerticalSpacer height={0} flexGrow={1} />
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
