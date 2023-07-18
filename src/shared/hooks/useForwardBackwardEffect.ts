import { useEffect, useMemo } from 'react';
import { AnimationItem } from 'lottie-web';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../anim/VariableStrategyProps';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import { useMappedValueWithCallbacks } from './useMappedValueWithCallbacks';

type CalculableSize =
  | { width: number; height: number }
  | { width: number; aspectRatio: number }
  | { height: number; aspectRatio: number };

type UseForwardBackwardEffectProps = {
  /**
   * True if this hook should be managing the animation item, false
   * otherwise.
   */
  enabled: VariableStrategyProps<boolean>;

  /**
   * The player that should be managed by this hook.
   */
  player: VariableStrategyProps<AnimationItem | undefined>;

  /**
   * The size to render the animation at, in pixels. May swap
   * one of width, height for the desired aspect ratio in
   * width/height.
   */
  size: VariableStrategyProps<CalculableSize>;

  /**
   * Determines how long to wait on each end of the animation before
   * reversing direction. Changing this value takes into affect at
   * the start of the next hold period.
   */
  holdTime: VariableStrategyProps<{
    /**
     * After completing the animation in the forward direction, how
     * long to wait before reversing direction.
     */
    forward: number;
    /**
     * After completing the animation in the backward direction, how
     * long to wait before reversing direction.
     */
    backward: number;
  }>;
};

type UseForwardBackwardEffectResult = {
  /**
   * The style that should be used for the player. This is a subset
   * of CSSProperties.
   */
  playerStyle: ValueWithCallbacks<{ width: string; height: string }>;
};

const computeSize = (
  size: CalculableSize
): { width: number; height: number; paddingRight: number; paddingBottom: number } => {
  if ('width' in size && 'height' in size) {
    const dpi = window.devicePixelRatio;
    const scaledTarget = {
      width: size.width * dpi,
      height: size.height * dpi,
    };
    const scaledPadding = {
      paddingRight: Math.ceil(scaledTarget.width) - scaledTarget.width,
      paddingBottom: Math.ceil(scaledTarget.height) - scaledTarget.height,
    };

    return {
      width: scaledTarget.width / dpi,
      height: scaledTarget.height / dpi,
      paddingRight: scaledPadding.paddingRight / dpi,
      paddingBottom: scaledPadding.paddingBottom / dpi,
    };
  } else if ('width' in size && 'aspectRatio' in size) {
    return computeSize({ width: size.width, height: size.width / size.aspectRatio });
  } else {
    return computeSize({ width: size.height * size.aspectRatio, height: size.height });
  }
};

/**
 * Manages the given lottie player to go forward then backward in an
 * infinite loop, holding the specified period of time at each end.
 */
export const useForwardBackwardEffect = ({
  enabled: enabledVariableStrategy,
  player: playerVariableStrategy,
  size: sizeVariableStrategy,
  holdTime: holdTimeVariableStrategy,
}: UseForwardBackwardEffectProps): UseForwardBackwardEffectResult => {
  const enabledVWC = useVariableStrategyPropsAsValueWithCallbacks(enabledVariableStrategy);
  const playerVWC = useVariableStrategyPropsAsValueWithCallbacks(playerVariableStrategy);
  const sizeVWC = useVariableStrategyPropsAsValueWithCallbacks(sizeVariableStrategy);
  const holdTimeVWC = useVariableStrategyPropsAsValueWithCallbacks(holdTimeVariableStrategy);
  const playerSizeVWC = useWritableValueWithCallbacks<{
    width: number;
    height: number;
    paddingBottom: number;
    paddingRight: number;
  }>(() => computeSize(sizeVWC.get()));
  const playerStyleVWC = useMappedValueWithCallbacks(playerSizeVWC, (size) => ({
    width: `${size.width}px`,
    height: `${size.height}px`,
    paddingBottom: `${size.paddingBottom}px`,
    paddingRight: `${size.paddingRight}px`,
  }));

  useEffect(() => {
    let playerManagerCanceler: (() => void) | null = null;
    enabledVWC.callbacks.add(handleEnabledChanged);
    sizeVWC.callbacks.add(updatePlayerSize);
    playerVWC.callbacks.add(handlePlayerChanged);
    updatePlayerSize();
    handlePlayerChanged();
    handleEnabledChanged();
    return () => {
      enabledVWC.callbacks.remove(handleEnabledChanged);
      sizeVWC.callbacks.remove(updatePlayerSize);
      playerVWC.callbacks.remove(handlePlayerChanged);
      if (playerManagerCanceler !== null) {
        playerManagerCanceler();
        playerManagerCanceler = null;
      }
    };

    function managePlayerState(player: AnimationItem): () => void {
      if (player.renderer === null) {
        return () => {};
      }

      let state:
        | 'loading'
        | 'forward'
        | 'holding-after-forward'
        | 'backward'
        | 'holding-after-backward' = 'loading';
      let holdTimeout: NodeJS.Timeout | null = null;
      if (player.isLoaded) {
        state = 'forward';
        player.setDirection(1);
        player.goToAndPlay(0, true);
      }

      const onLoad = () => {
        if (state !== 'loading') {
          return;
        }

        player.removeEventListener('data_ready', onLoad);
        player.goToAndPlay(0, true);
        state = 'forward';
        player.addEventListener('complete', onComplete);
      };

      const onComplete = () => {
        if (state !== 'forward' && state !== 'backward') {
          return;
        }

        player.pause();
        holdTimeout = setTimeout(onHoldFinished, holdTimeVWC.get()[state]);
        state = state === 'forward' ? 'holding-after-forward' : 'holding-after-backward';
        player.removeEventListener('complete', onComplete);
      };

      const onHoldFinished = () => {
        if (state !== 'holding-after-forward' && state !== 'holding-after-backward') {
          return;
        }

        holdTimeout = null;

        if (state === 'holding-after-forward') {
          player.setDirection(-1);
          player.play();
          state = 'backward';
        } else {
          player.setDirection(1);
          player.play();
          state = 'forward';
        }

        player.addEventListener('complete', onComplete);
      };

      if (state === 'loading') {
        player.addEventListener('data_ready', onLoad);
      } else {
        player.addEventListener('complete', onComplete);
      }

      return () => {
        if (holdTimeout !== null) {
          clearTimeout(holdTimeout);
          holdTimeout = null;
        }

        // not sure what the correct solution is here, but the player doesn't
        // want us to call removeEventListener once it's been destroyed
        if (player.renderer === null) {
          return;
        }

        if (state === 'loading') {
          player.removeEventListener('data_ready', onLoad);
        }

        if (state === 'forward' || state === 'backward') {
          player.removeEventListener('complete', onComplete);
        }
      };
    }

    function updatePlayerSize() {
      const correctSize = computeSize(sizeVWC.get());
      if (
        playerSizeVWC.get().width !== correctSize.width ||
        playerSizeVWC.get().height !== correctSize.height
      ) {
        playerSizeVWC.set(correctSize);
        playerSizeVWC.callbacks.call(undefined);
      }
    }

    function handlePlayerChanged() {
      if (playerManagerCanceler !== null) {
        playerManagerCanceler();
        playerManagerCanceler = null;
      }

      if (!enabledVWC.get()) {
        return;
      }

      const player = playerVWC.get();
      if (player === undefined) {
        return;
      }

      playerManagerCanceler = managePlayerState(player);
    }

    function handleEnabledChanged() {
      if (enabledVWC.get() !== (playerManagerCanceler !== null)) {
        handlePlayerChanged();
      }
    }
  }, [enabledVWC, playerVWC, sizeVWC, holdTimeVWC, playerSizeVWC]);

  return useMemo(() => ({ playerStyle: playerStyleVWC }), [playerStyleVWC]);
};
