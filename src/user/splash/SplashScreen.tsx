import { ReactElement, useCallback, useRef } from 'react';
import { useFullHeight } from '../../shared/hooks/useFullHeight';
import styles from './SplashScreen.module.css';
import brandmark from './assets/brandmark.lottie.json';
import wordmark from './assets/wordmark.lottie.json';
import { Player } from '@lottiefiles/react-lottie-player';
import { AnimationItem } from 'lottie-web';
import { useWindowSizeValueWithCallbacks } from '../../shared/hooks/useWindowSize';
import { useForwardBackwardEffect } from '../../shared/hooks/useForwardBackwardEffect';
import { useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';

const BRANDMARK_HOLD_TIME_MS = { forward: 750, backward: 500 };
const BRANDMARK_WIDTH = (windowSize: { width: number; height: number }): number =>
  Math.min(0.75 * windowSize.width, 0.75 * windowSize.height, 250);
const BRANDMARK_NATURAL_ASPECT_RATIO = 1341 / 1080;

const WORDMARK_HOLD_TIME_MS = { forward: 750, backward: 500 };
const WORDMARK_WIDTH = (windowSize: { width: number; height: number }): number =>
  Math.min(0.75 * windowSize.width, 0.75 * windowSize.height, 163);
const WORDMARK_NATURAL_ASPECT_RATIO = 1407 / 615;

type SplashScreenProps = {
  /**
   * The style to use for the spinner. Defaults to 'brandmark'
   */
  type?: 'wordmark' | 'brandmark' | undefined;
};

export const SplashScreen = ({ type = undefined }: SplashScreenProps): ReactElement => {
  const realStyle = type ?? 'brandmark';
  const containerRef = useRef<HTMLDivElement>(null);
  const playerVWC = useWritableValueWithCallbacks<AnimationItem | undefined>(() => undefined);
  const windowSizeVWC = useWindowSizeValueWithCallbacks();

  const setPlayerRef = useCallback(
    (player: AnimationItem) => {
      playerVWC.set(player);
      playerVWC.callbacks.call(undefined);
    },
    [playerVWC]
  );

  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSizeVWC });
  const { playerStyle: playerStyleBrandmark } = useForwardBackwardEffect({
    enabled: { type: 'react-rerender', props: realStyle === 'brandmark' },
    player: adaptValueWithCallbacksAsVariableStrategyProps(playerVWC),
    size: adaptValueWithCallbacksAsVariableStrategyProps(
      useMappedValueWithCallbacks(windowSizeVWC, (windowSize) => ({
        aspectRatio: BRANDMARK_NATURAL_ASPECT_RATIO,
        width: BRANDMARK_WIDTH(windowSize),
      }))
    ),
    holdTime: { type: 'react-rerender', props: BRANDMARK_HOLD_TIME_MS },
  });
  const { playerStyle: playerStyleWordmark } = useForwardBackwardEffect({
    enabled: { type: 'react-rerender', props: realStyle === 'wordmark' },
    player: adaptValueWithCallbacksAsVariableStrategyProps(playerVWC),
    size: adaptValueWithCallbacksAsVariableStrategyProps(
      useMappedValueWithCallbacks(windowSizeVWC, (windowSize) => ({
        aspectRatio: WORDMARK_NATURAL_ASPECT_RATIO,
        width: WORDMARK_WIDTH(windowSize),
      }))
    ),
    holdTime: { type: 'react-rerender', props: WORDMARK_HOLD_TIME_MS },
  });
  const playerStyleVWC = realStyle === 'brandmark' ? playerStyleBrandmark : playerStyleWordmark;

  return (
    <div className={styles.container} ref={containerRef}>
      <RenderGuardedComponent
        props={playerStyleVWC}
        component={(playerStyle) => (
          <Player
            lottieRef={setPlayerRef}
            src={realStyle === 'brandmark' ? brandmark : wordmark}
            keepLastFrame={true}
            style={playerStyle}
          />
        )}
      />
    </div>
  );
};
