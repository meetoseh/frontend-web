import { useMemo } from 'react';
import { useDynamicAnimationEngine } from '../anim/useDynamicAnimation';
import { ease } from '../lib/Bezier';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import {
  TransitionProp,
  useAttachDynamicEngineToTransition,
  useOsehTransition,
  useSetTransitionReady,
} from '../lib/TransitionProp';
import { setVWC } from '../lib/setVWC';
import { useWindowSizeValueWithCallbacks } from './useWindowSize';

/**
 * Our collection of standard supported screen transitions
 */
export type StandardScreenTransition =
  | {
      type: 'swipe';
      /** If someone swipes to the left, then we enter from the right and exit to the left */
      direction: 'to-left' | 'to-right';
      ms: number;
    }
  | {
      type: 'fade';
      ms: number;
    }
  | {
      /**
       * For entering, the screen starts at the black gray gradient, then we
       * reduce the height, keeping it either at the top (for direction=up)
       * or bottom (for direction=down), until its height is zero and the normal
       * screen is displayed. For exiting, the same but the height starts at zero
       * and increases.
       */
      type: 'wipe';
      direction: 'up' | 'down';
      ms: number;
    }
  | {
      type: 'none';
      ms: number;
    };

/** The transition prop for the standard screen transitions */
export type StandardScreenTransitionProp = TransitionProp<
  StandardScreenTransition['type'],
  StandardScreenTransition
>;

/** Describes how a wipe gradient should be displayed */
export type StandardWipeState = {
  /** For up, glue the overlay to the top, otherwise to the bottom */
  direction: 'up' | 'down';
  /** The percentage of the screen taken up by the overlay */
  heightPercentage: number;
};

/**
 * The state that is returned by this hook. All the screen needs to
 * do to support the standard transitions is attach these values to
 * the appropriate styles (usually via mapping to a ViewStyle then using
 * useStyleVWC)
 */
export type StandardScreenTransitionState = {
  /** The left offset, in logical pixels, for the foreground */
  left: ValueWithCallbacks<number>;

  /**
   * The opacity of the foreground. If the background is not the
   * standard dark black to gray gradient, its usually better to
   * implement this as the inverse opacity of an overlay, where
   * the overlay is the standard dark black to gray gradient, so
   * that you always start entrance transitions on the standard dark
   * black to gray gradient.
   *
   * This can be handled by OpacityTransitionOverlay if animating the
   * foreground directly is not feasible.
   */
  opacity: ValueWithCallbacks<number>;

  /**
   * Describes which part of the screen is covered by the wipe gradient,
   * or null for equivalent to heightPercentage: 0
   *
   * This can be handled by WipeTransitionOverlay
   */
  wipe: ValueWithCallbacks<StandardWipeState | null>;
};

/**
 * Uses the given transition prop to drive the returned state which will
 * result in the appropriate standard screen transitions when they are used
 * for the appropriate styles.
 *
 * NOTE: You still need useEntranceTransition somewhere to ensure the entrance
 * transition is actually played.
 *
 * NOTE: If your component receives an optional transition prop, use
 * useInitializedTransitionProp to pass it here.
 */
export const useStandardTransitionsState = (
  transition: StandardScreenTransitionProp
): StandardScreenTransitionState => {
  const engine = useDynamicAnimationEngine();
  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const leftVWC = useWritableValueWithCallbacks(() => {
    const cfg = transition.animation.get();
    if (cfg.type !== 'swipe') {
      return 0;
    }
    if (cfg.direction === 'to-left') {
      return windowSizeVWC.get().width;
    } else {
      return -windowSizeVWC.get().width;
    }
  });
  const opacityVWC = useWritableValueWithCallbacks((): number => {
    const cfg = transition.animation.get();
    if (cfg.type !== 'fade') {
      return 1;
    }
    return 0;
  });
  const wipeVWC = useWritableValueWithCallbacks<StandardWipeState | null>(() => {
    const cfg = transition.animation.get();
    if (cfg.type !== 'wipe') {
      return null;
    }
    return { direction: cfg.direction, heightPercentage: 1 };
  });

  useOsehTransition(
    transition,
    'swipe',
    (cfg) => {
      const startX = leftVWC.get();
      const endX = 0;
      const dx = endX - startX;
      engine.play([
        {
          id: 'std-swipe-in',
          duration: cfg.ms,
          progressEase: { type: 'bezier', bezier: ease },
          onFrame: (progress) => {
            setVWC(leftVWC, startX + dx * progress);
          },
        },
      ]);
    },
    (cfg) => {
      const startX = leftVWC.get();
      const endX =
        cfg.direction === 'to-left' ? -windowSizeVWC.get().width : windowSizeVWC.get().width;
      const dx = endX - startX;
      engine.play([
        {
          id: 'std-swipe-out',
          duration: cfg.ms,
          progressEase: { type: 'bezier', bezier: ease },
          onFrame: (progress) => {
            setVWC(leftVWC, startX + dx * progress);
          },
        },
      ]);
    }
  );
  useOsehTransition(
    transition,
    'fade',
    (cfg) => {
      const startOpacity = opacityVWC.get();
      const endOpacity = 1;
      const dx = endOpacity - startOpacity;
      engine.play([
        {
          id: 'std-fade-in',
          duration: cfg.ms,
          progressEase: { type: 'bezier', bezier: ease },
          onFrame: (progress) => {
            setVWC(opacityVWC, startOpacity + dx * progress);
          },
        },
      ]);
    },
    (cfg) => {
      const startOpacity = opacityVWC.get();
      const endOpacity = 0;
      const dx = endOpacity - startOpacity;
      engine.play([
        {
          id: 'std-fade-out',
          duration: cfg.ms,
          progressEase: { type: 'bezier', bezier: ease },
          onFrame: (progress) => {
            setVWC(opacityVWC, startOpacity + dx * progress);
          },
        },
      ]);
    }
  );
  useOsehTransition(
    transition,
    'wipe',
    (cfg) => {
      const initialWipe = wipeVWC.get();
      const start = initialWipe === null ? 0 : 1;
      const dx = -start;

      engine.play([
        {
          id: 'std-wipe-out',
          duration: cfg.ms,
          progressEase: { type: 'bezier', bezier: ease },
          onFrame: (progress) => {
            const heightPercentage = start + dx * progress;
            if (heightPercentage < 1e-3) {
              setVWC(wipeVWC, null);
            } else {
              setVWC(wipeVWC, { direction: cfg.direction, heightPercentage });
            }
          },
        },
      ]);
    },
    (cfg) => {
      const initialWipe = wipeVWC.get();
      const start = initialWipe === null ? 0 : 1;
      const dx = 1 - start;

      engine.play([
        {
          id: 'std-wipe-in',
          duration: cfg.ms,
          progressEase: { type: 'bezier', bezier: ease },
          onFrame: (progress) => {
            setVWC(wipeVWC, {
              direction: cfg.direction,
              heightPercentage: start + dx * progress,
            });
          },
        },
      ]);
    }
  );
  useAttachDynamicEngineToTransition(transition, engine);
  useSetTransitionReady(transition);
  return useMemo(
    () => ({
      left: leftVWC,
      opacity: opacityVWC,
      wipe: wipeVWC,
    }),
    [leftVWC, opacityVWC, wipeVWC]
  );
};
