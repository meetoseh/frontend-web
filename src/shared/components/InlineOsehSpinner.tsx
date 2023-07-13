import { useCallback } from 'react';
import { useWritableValueWithCallbacks } from '../lib/Callbacks';
import { Player } from '@lottiefiles/react-lottie-player';
import { AnimationItem } from 'lottie-web';
import styles from './InlineOsehSpinner.module.css';
import spinnerBlack from './assets/spinner-black.json';
import spinnerWhite from './assets/spinner-white.json';
import spinnerPrimary from './assets/spinner-primary.json';
import { useForwardBackwardEffect } from '../hooks/useForwardBackwardEffect';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../lib/adaptValueWithCallbacksAsVariableStrategyProps';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../anim/VariableStrategyProps';
import { useMappedValueWithCallbacks } from '../hooks/useMappedValueWithCallbacks';
import { RenderGuardedComponent } from './RenderGuardedComponent';

type InlineOsehSpinnerProps = {
  size: VariableStrategyProps<{ width: number } | { height: number }>;
  variant?: 'black' | 'white' | 'primary';
};

/**
 * Shows the oseh brandmark in a configurable size. The brandmark is nearly
 * square, but not quite. To avoid accidentally squishing it, you can specify
 * either a width or a height, and the other dimension will be calculated.
 */
export const InlineOsehSpinner = ({
  size: sizeVariableStrategy,
  variant = 'white',
}: InlineOsehSpinnerProps) => {
  const sizeVWC = useVariableStrategyPropsAsValueWithCallbacks(sizeVariableStrategy);
  const playerVWC = useWritableValueWithCallbacks<AnimationItem | undefined>(() => undefined);

  const setPlayerRef = useCallback(
    (player: AnimationItem) => {
      playerVWC.set(player);
      playerVWC.callbacks.call(undefined);
    },
    [playerVWC]
  );
  const { playerStyle: playerStyleVWC } = useForwardBackwardEffect({
    enabled: { type: 'react-rerender', props: true },
    player: adaptValueWithCallbacksAsVariableStrategyProps(playerVWC),
    size: adaptValueWithCallbacksAsVariableStrategyProps(
      useMappedValueWithCallbacks(sizeVWC, (s) => ({ ...s, aspectRatio: NATURAL_ASPECT_RATIO }), {
        inputEqualityFn: (a: any, b: any) => a.width === b.width && a.height === b.height,
      })
    ),
    holdTime: { type: 'react-rerender', props: HOLD_TIME_MS },
  });

  return (
    <div className={styles.container}>
      <RenderGuardedComponent
        props={playerStyleVWC}
        component={(playerStyle) => (
          <Player
            lottieRef={setPlayerRef}
            src={
              {
                black: spinnerBlack,
                white: spinnerWhite,
                primary: spinnerPrimary,
              }[variant]
            }
            keepLastFrame={true}
            style={playerStyle}
          />
        )}
      />
    </div>
  );
};

const HOLD_TIME_MS = { forward: 750, backward: 500 };
const NATURAL_ASPECT_RATIO = 197 / 186;
