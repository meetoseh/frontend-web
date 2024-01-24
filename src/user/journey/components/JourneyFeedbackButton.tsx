import React, { ReactElement, useCallback, useMemo, useRef } from 'react';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import styles from './JourneyFeedbackButton.module.css';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';
import { useDynamicAnimationEngine } from '../../../shared/anim/useDynamicAnimation';
import { ease, easeInOut, easeOutBack } from '../../../shared/lib/Bezier';
import { interpolateColor, interpolateNumber } from '../../../shared/lib/BezierAnimation';
import { setVWC } from '../../../shared/lib/setVWC';

export type JourneyFeedbackButtonProps = {
  /**
   * True if this button is in the selected state, false otherwise.
   */
  selected: ValueWithCallbacks<boolean>;

  /**
   * The background color for the emoji. Animating the emoji goes faster
   * when the renderer doesn't need to worry about transparency, so where
   * transparency is desired it should be approximated
   */
  background: ValueWithCallbacks<[number, number, number]>;

  /**
   * The emoji to display in the button. This will handle grayscaling
   * as necessary
   */
  emoji: string;

  /**
   * The label to display while the button is selected
   */
  label: string;

  /**
   * Callback for when this button is pressed. Should result in this
   * button being selected.
   */
  onPress: () => void;
};

type AnimationStateBackground = {
  /* 0-255 rgb, 0-1 opacity */
  color1: [number, number, number, number];
  color2: [number, number, number, number];
};

type AnimationStateEmoji = {
  /* degrees */
  rotation: number;
  /* 1 = 100%  */
  scale: number;
  /* 0-1 grayscale strength */
  grayscale: number;
};

type AnimationStateLabel = {
  /** 0-1 */
  opacity: number;

  /** 1 = 100% */
  scale: number;

  /** 0-1 */
  exclamationOpacity: number;
};

type AnimationState = {
  background: ValueWithCallbacks<AnimationStateBackground>;
  emoji: ValueWithCallbacks<AnimationStateEmoji>;
  label: ValueWithCallbacks<AnimationStateLabel>;
};

const useAnimationState = (
  selectedVWC: ValueWithCallbacks<boolean>,
  backgroundTargetVWC: ValueWithCallbacks<[number, number, number]>
): AnimationState => {
  const backgroundVWC = useWritableValueWithCallbacks<AnimationStateBackground>(() => ({
    color1: [...backgroundTargetVWC.get(), 1],
    color2: [...backgroundTargetVWC.get(), 1],
  }));
  const emojiVWC = useWritableValueWithCallbacks<AnimationStateEmoji>(() => ({
    rotation: 0,
    scale: 1,
    grayscale: 0,
  }));
  const labelVWC = useWritableValueWithCallbacks<AnimationStateLabel>(() => ({
    opacity: 0,
    scale: 1,
    exclamationOpacity: 0,
    exclamationScale: 1,
    rotation: 0,
  }));

  const engine = useDynamicAnimationEngine();

  useValueWithCallbacksEffect(selectedVWC, (selected) => {
    const bkndRef = backgroundVWC.get();
    const initialBackground = {
      color1: [...bkndRef.color1],
      color2: [...bkndRef.color2],
    };

    const emojiRef = emojiVWC.get();
    const initialEmoji = { ...emojiRef };

    const labelRef = labelVWC.get();
    const initialLabel = { ...labelRef };

    if (!selected) {
      engine.play([
        {
          id: 'background',
          duration: 350,
          progressEase: { type: 'bezier', bezier: ease },
          onFrame: (progress) => {
            const targetZeroTo1 = backgroundTargetVWC.get();
            const target = [targetZeroTo1[0] * 255, targetZeroTo1[1] * 255, targetZeroTo1[2] * 255];
            setVWC(backgroundVWC, {
              color1: [...interpolateColor(initialBackground.color1, target, progress), 1] as [
                number,
                number,
                number,
                number
              ],
              color2: [...interpolateColor(initialBackground.color2, target, progress), 1] as [
                number,
                number,
                number,
                number
              ],
            });
          },
        },
        {
          id: 'emoji',
          duration: 350,
          progressEase: { type: 'bezier', bezier: ease },
          onFrame: (progress) => {
            setVWC(emojiVWC, {
              rotation: interpolateNumber(initialEmoji.rotation, 0, progress),
              scale: interpolateNumber(initialEmoji.scale, 1, progress),
              grayscale: interpolateNumber(initialEmoji.grayscale, 1, progress),
            });
          },
        },
        {
          id: 'label',
          duration: 350,
          progressEase: { type: 'bezier', bezier: ease },
          onFrame: (progress) => {
            setVWC(labelVWC, {
              opacity: interpolateNumber(initialLabel.opacity, 0, progress),
              scale: interpolateNumber(initialLabel.scale, 1, progress),
              exclamationOpacity: interpolateNumber(initialLabel.exclamationOpacity, 0, progress),
            });
          },
        },
      ]);
    } else {
      const scaleFirstDirection = (Math.random() > 0.5 ? 1 : -1) as 1 | -1;
      const rotationTarget = 360 * (Math.random() > 0.5 ? 1 : -1);

      engine.play([
        {
          id: 'background',
          duration: 350,
          progressEase: { type: 'bezier', bezier: ease },
          onFrame: (progress) => {
            setVWC(backgroundVWC, {
              color1: [
                ...interpolateColor(initialBackground.color1, [87, 184, 162], progress),
                1,
              ] as [number, number, number, number],
              color2: [
                ...interpolateColor(initialBackground.color2, [20, 128, 128], progress),
                1,
              ] as [number, number, number, number],
            });
          },
        },
        {
          id: 'emojiGrayscale',
          duration: 350,
          progressEase: { type: 'bezier', bezier: ease },
          onFrame: (progress) => {
            setVWC(emojiVWC, {
              ...emojiVWC.get(),
              grayscale: interpolateNumber(initialEmoji.grayscale, 0, progress),
            });
          },
        },
        {
          id: 'emojiRotation',
          duration: 1000,
          progressEase: { type: 'bezier', bezier: easeOutBack },
          onFrame: (progress) => {
            setVWC(emojiVWC, {
              ...emojiVWC.get(),
              rotation: interpolateNumber(initialEmoji.rotation, rotationTarget, progress),
            });
          },
          onFinish: () => {
            setVWC(emojiVWC, {
              ...emojiVWC.get(),
              rotation: 0,
            });
          },
        },
        {
          id: 'emojiScaleReset',
          duration: 100,
          progressEase: { type: 'bezier', bezier: ease },
          onFrame: (progress) => {
            setVWC(emojiVWC, {
              ...emojiVWC.get(),
              scale: interpolateNumber(initialEmoji.scale, 1, progress),
            });
          },
        },
        {
          id: 'emojiScale1',
          delayUntil: { type: 'relativeToEnd', id: 'emojiScaleReset', after: 0 },
          duration: 175,
          progressEase: { type: 'bezier', bezier: ease },
          onFrame: (progress) => {
            setVWC(emojiVWC, {
              ...emojiVWC.get(),
              scale: interpolateNumber(1, 1 + 0.1 * scaleFirstDirection, progress),
            });
          },
        },
        {
          id: 'emojiScale2',
          delayUntil: { type: 'relativeToEnd', id: 'emojiScale1', after: 0 },
          duration: 350,
          progressEase: { type: 'bezier', bezier: easeInOut },
          onFrame: (progress) => {
            setVWC(emojiVWC, {
              ...emojiVWC.get(),
              scale: interpolateNumber(
                1 + 0.1 * scaleFirstDirection,
                1 - 0.1 * scaleFirstDirection,
                progress
              ),
            });
          },
        },
        {
          id: 'emojiScale3',
          delayUntil: { type: 'relativeToEnd', id: 'emojiScale2', after: 0 },
          duration: 175,
          progressEase: { type: 'bezier', bezier: ease },
          onFrame: (progress) => {
            setVWC(emojiVWC, {
              ...emojiVWC.get(),
              scale: interpolateNumber(1 - 0.1 * scaleFirstDirection, 1, progress),
            });
          },
        },
        {
          id: 'labelPrepare',
          delayUntil: { type: 'relativeToStart', id: 'emojiRotation', after: 0 },
          duration: 100,
          progressEase: { type: 'bezier', bezier: ease },
          onFrame: (progress) => {
            setVWC(labelVWC, {
              ...labelVWC.get(),
              scale: interpolateNumber(initialLabel.scale, 1.4, progress),
            });
          },
        },
        {
          id: 'labelFadeIn',
          delayUntil: { type: 'relativeToStart', id: 'emojiRotation', after: 500 },
          duration: 350,
          progressEase: { type: 'bezier', bezier: ease },
          onFrame: (progress) => {
            setVWC(labelVWC, {
              ...labelVWC.get(),
              opacity: interpolateNumber(initialLabel.opacity, 1, progress),
              exclamationOpacity: interpolateNumber(initialLabel.exclamationOpacity, 1, progress),
            });
          },
        },
        {
          id: 'labelScaleIn',
          delayUntil: { type: 'relativeToStart', id: 'labelFadeIn', after: 0 },
          duration: 350,
          progressEase: { type: 'bezier', bezier: ease },
          onFrame: (progress) => {
            setVWC(labelVWC, {
              ...labelVWC.get(),
              scale: interpolateNumber(1.4, 1, progress),
            });
          },
        },
        {
          id: 'labelExclamationFadeOut',
          delayUntil: { type: 'relativeToEnd', id: 'labelFadeIn', after: 500 },
          duration: 350,
          progressEase: { type: 'bezier', bezier: ease },
          onFrame: (progress) => {
            setVWC(labelVWC, {
              ...labelVWC.get(),
              exclamationOpacity: interpolateNumber(1, 0, progress),
            });
          },
        },
      ]);
    }
    return undefined;
  });

  return useMemo(
    () => ({
      background: backgroundVWC,
      emoji: emojiVWC,
      label: labelVWC,
    }),
    [backgroundVWC, emojiVWC, labelVWC]
  );
};

const makeLinearGradient = (background: AnimationStateBackground): string => {
  return `linear-gradient(211deg, rgb(${background.color1[0]}, ${background.color1[1]}, ${background.color1[2]}) 22.39%, rgb(${background.color2[0]}, ${background.color2[1]}, ${background.color2[2]}) 84.62%)`;
};

/**
 * Shows a single small juicy feedback button with an emoji and a label.
 */
export const JourneyFeedbackButton = ({
  selected,
  background,
  emoji,
  label,
  onPress,
}: JourneyFeedbackButtonProps): ReactElement => {
  const handlePress = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      onPress();
    },
    [onPress]
  );

  const animationState = useAnimationState(selected, background);
  const emojiContainerRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const labelExclamationRef = useRef<HTMLDivElement>(null);

  useValueWithCallbacksEffect(animationState.background, (bknd) => {
    if (emojiContainerRef.current) {
      emojiContainerRef.current.style.background = makeLinearGradient(bknd);
    }
    return undefined;
  });

  useValueWithCallbacksEffect(animationState.emoji, (emoji) => {
    if (emojiRef.current) {
      emojiRef.current.style.transform = `rotate(${emoji.rotation}deg) scale(${emoji.scale})`;
      emojiRef.current.style.filter = `grayscale(${emoji.grayscale * 100}%)`;
    }
    return undefined;
  });

  useValueWithCallbacksEffect(animationState.label, (label) => {
    if (labelRef.current) {
      labelRef.current.style.opacity = label.opacity.toString();
      labelRef.current.style.transform = `scale(${label.scale})`;
    }
    if (labelExclamationRef.current) {
      labelExclamationRef.current.style.opacity = label.exclamationOpacity.toString();
    }
    return undefined;
  });

  return (
    <button type="button" className={styles.button} onClick={handlePress}>
      <div
        className={styles.emoji}
        ref={emojiContainerRef}
        style={{
          background: makeLinearGradient(animationState.background.get()),
        }}>
        <div
          ref={emojiRef}
          className={styles.emojiInner}
          style={{
            transform: `rotate(${animationState.emoji.get().rotation}deg) scale(${
              animationState.emoji.get().scale
            })`,
            filter: `grayscale(${animationState.emoji.get().grayscale * 100}%)`,
          }}>
          {emoji}
        </div>
      </div>
      <div
        ref={labelRef}
        className={styles.label}
        style={{
          opacity: animationState.label.get().opacity,
          transform: `scale(${animationState.label.get().scale})`,
        }}>
        {label}
        <span
          className={styles.labelExclamation}
          ref={labelExclamationRef}
          style={{
            opacity: animationState.label.get().exclamationOpacity,
          }}>
          !
        </span>
      </div>
    </button>
  );
};
