import { useCallback, useRef } from 'react';
import { Modals, addModalWithCallbackToRemove } from '../contexts/ModalContext';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../lib/Callbacks';
import { useValueWithCallbacksEffect } from './useValueWithCallbacksEffect';
import styles from './useSavingModal.module.css';
import { InlineOsehSpinner } from '../components/InlineOsehSpinner';
import { useWindowSizeValueWithCallbacks } from './useWindowSize';
import { useMappedValueWithCallbacks } from './useMappedValueWithCallbacks';
import { setVWC } from '../lib/setVWC';
import { useAnimatedValueWithCallbacks } from '../anim/useAnimatedValueWithCallbacks';
import { BezierAnimator } from '../anim/AnimationLoop';
import { ease } from '../lib/Bezier';

type Options = {
  /**
   * The message to display describing the action the user is waiting
   * on
   * @default 'Saving'
   */
  message?: string;
};

const DEFAULT_OPTIONS: Required<Options> = {
  message: 'Saving',
};

/**
 * Overlays a spinner on top of the current screen. Should be used only when
 * saving data to the server is taking an excessive period of time that could
 * not be successfully hidden with an animation
 *
 * @param modals The modals to use to show the error
 * @param visible True to show the overlay, false to hide it
 */
export const useSavingModal = (
  modals: WritableValueWithCallbacks<Modals>,
  visible: ValueWithCallbacks<boolean>,
  opts?: {
    /** @default 'Saving' */
    message: string;
  }
) => {
  const options: Required<Options> = Object.assign({}, DEFAULT_OPTIONS, opts);

  const showingModal = useWritableValueWithCallbacks<boolean>(() => false);
  const fadingOut = useWritableValueWithCallbacks<boolean>(() => false);

  useValueWithCallbacksEffect(visible, (v) => {
    if (v) {
      setVWC(fadingOut, false);
      setVWC(showingModal, true);
      return undefined;
    }

    if (!showingModal.get()) {
      return undefined;
    }

    setVWC(fadingOut, true);
    let timeout: NodeJS.Timeout | null = null;
    const onTimeout = () => {
      timeout = null;
      setVWC(showingModal, false);
    };
    timeout = setTimeout(onTimeout, 350);
    return () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
    };
  });

  useValueWithCallbacksEffect(
    showingModal,
    useCallback(
      (visible) => {
        if (!visible) {
          return undefined;
        }

        return addModalWithCallbackToRemove(
          modals,
          <SavingModal message={options.message} fadingOut={fadingOut} />
        );
      },
      [options, modals, fadingOut]
    )
  );
};

type SavingModalAnimationState = {
  backgroundOpacity: number;
  foregroundOpacity: number;
};
const initialSavingModalAnimationState = () => ({
  backgroundOpacity: 0,
  foregroundOpacity: 0,
});
const finalSavingModalAnimationState = () => ({
  backgroundOpacity: 0.9,
  foregroundOpacity: 1,
});

const SavingModal = ({
  message,
  fadingOut,
}: {
  message: string;
  fadingOut: ValueWithCallbacks<boolean>;
}) => {
  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const iconWidth = useMappedValueWithCallbacks(windowSizeVWC, (windowSize) =>
    Math.min(0.33 * windowSize.width, 0.33 * windowSize.height, 120)
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const foregroundRef = useRef<HTMLDivElement>(null);

  const rendered = useWritableValueWithCallbacks<SavingModalAnimationState>(
    initialSavingModalAnimationState
  );
  const animationTarget = useAnimatedValueWithCallbacks<SavingModalAnimationState>(
    initialSavingModalAnimationState,
    [
      new BezierAnimator(
        ease,
        350,
        (p) => p.backgroundOpacity,
        (p, v) => (p.backgroundOpacity = v)
      ),
      new BezierAnimator(
        ease,
        350,
        (p) => p.foregroundOpacity,
        (p, v) => (p.foregroundOpacity = v)
      ),
    ],
    (val) => {
      const container = containerRef.current;
      const foreground = foregroundRef.current;

      if (container !== null) {
        container.style.background = `rgba(0, 0, 0, ${val.backgroundOpacity})`;
      }

      if (foreground !== null) {
        foreground.style.opacity = `${val.foregroundOpacity}`;
      }
    },
    rendered
  );

  useValueWithCallbacksEffect(fadingOut, (v) => {
    if (v) {
      setVWC(animationTarget, initialSavingModalAnimationState());
    } else {
      setVWC(animationTarget, finalSavingModalAnimationState());
    }
    return undefined;
  });

  return (
    <div
      className={styles.container}
      style={{ background: `rgba(0, 0, 0, ${rendered.get().backgroundOpacity})` }}
      onClickCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      ref={containerRef}>
      <div
        className={styles.innerContainer}
        style={{ opacity: rendered.get().foregroundOpacity.toString() }}
        ref={foregroundRef}>
        <div className={styles.spinnerContainer}>
          <InlineOsehSpinner
            variant="white-thin"
            size={{
              type: 'callbacks',
              props: () => ({ width: iconWidth.get() }),
              callbacks: iconWidth.callbacks,
            }}
          />
        </div>
        <div className={styles.message}>{message}</div>
      </div>
    </div>
  );
};
