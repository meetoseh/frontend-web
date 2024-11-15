import { ReactElement } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import styles from './Fork.module.css';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ForkResources } from './ForkResources';
import { ForkMappedParams } from './ForkParams';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { configurableScreenOut } from '../../lib/configurableScreenOut';
import { OsehColors } from '../../../../shared/OsehColors';
import { Forward } from '../../../../shared/components/icons/Forward';

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
                configurableScreenOut(
                  workingVWC,
                  startPop,
                  transition,
                  option.exit,
                  option.trigger,
                  {
                    afterDone: () => {
                      trace({
                        type: 'fork_option_selected',
                        option,
                      });
                    },
                  }
                );
              }}>
              <div className={styles.optionText}>{option.text}</div>
              <Forward
                icon={{ width: 20 }}
                container={{ width: 20, height: 20 }}
                startPadding={{ x: { fraction: 0.5 }, y: { fraction: 0.5 } }}
                color={OsehColors.v4.primary.light}
              />
            </button>
          ))}
        </div>
        <VerticalSpacer height={0} flexGrow={1} />
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
