import { PropsWithChildren, ReactElement, useRef } from 'react';
import styles from './DidYouKnow.module.css';
import { useSimpleAnimation } from '../hooks/useSimpleAnimation';
import { Bezier, easeOutBack } from '../lib/Bezier';

type DidYouKnowAnimationProps = {
  /**
   * If specified, all animations are delayed the given number of milliseconds
   * in addition to any individual delays normally applied.
   */
  delay?: number;

  /**
   * If true, animation delays will not advance and animations will not play.
   */
  paused?: boolean;

  /**
   * If specified, called when the first animation starts.
   */
  onStarted?: () => void;

  /**
   * If specified, called when all animations complete.
   */
  onFinished?: () => void;
};

type DidYouKnowProps = {
  /**
   * If specified, controls the animations of the component. This object can
   * be changed with no effect, so long as the values are the same, i.e.,
   * it's not necessary to memoize the object, but it is necessary to memoize
   * the callbacks within (if used).
   */
  animation?: DidYouKnowAnimationProps;

  /**
   * If specified, the title to display above the fact. Defaults to
   * Did you know?
   */
  title?: ReactElement | string;
};

/**
 * Renders a did-you-know section, which has a built-in title, and the children
 * describe the fact.
 */
export const DidYouKnow = ({
  animation,
  title,
  children,
}: PropsWithChildren<DidYouKnowProps>): ReactElement => {
  return (
    <div className={styles.container}>
      <div className={styles.iconContainer}>
        <LightbulbAnimatedIcon {...animation} />
      </div>
      <div className={styles.title}>{title ?? <>Did you know?</>}</div>
      <div className={styles.fact}>{children}</div>
    </div>
  );
};

type LightbulbAnimationState = {
  duration: number;
  ease: Bezier;
};

const lightbulbAnimation = {
  initialize: (ref: HTMLDivElement, animationTime: number): LightbulbAnimationState => {
    if (animationTime === 0) {
      ref.style.display = 'none';
    } else {
      ref.style.display = 'block';
    }

    return { duration: 500, ease: easeOutBack };
  },
  render: (ref: HTMLDivElement, state: LightbulbAnimationState, animationTime: number) => {
    const growProgress = state.ease.y_x(Math.min(1, animationTime / state.duration));

    // Scaling using transform will keep the center of the element in the same
    // spot, but we want to keep the bottom center in the same spot. So we have
    // a y-adjustment we need to make
    const defaultHeight = 15;
    const newHeight = defaultHeight * growProgress;
    const yAdjustment = (defaultHeight - newHeight) / 2;

    ref.style.display = 'block';
    ref.style.transform = `scale(${growProgress}) translate(0px, ${yAdjustment}px)`;
  },
  tick: (ref: HTMLDivElement, state: LightbulbAnimationState, animationTime: number): boolean => {
    return animationTime < state.duration;
  },
  dispose: (ref: HTMLDivElement, state: LightbulbAnimationState) => {},
};

const LightbulbAnimatedIcon = ({
  delay = 0,
  paused = false,
  onStarted,
  onFinished,
}: DidYouKnowAnimationProps): ReactElement => {
  const lightbulbRef = useRef<HTMLDivElement>(null);

  useSimpleAnimation({
    ref: lightbulbRef,
    delay,
    paused,
    onStarted,
    onFinished,
    ...lightbulbAnimation,
  });

  return (
    <>
      <div className={styles.silhouetteWrapper}>
        <div className={styles.silhouette}></div>
      </div>
      <div className={styles.lightbulbWrapper}>
        <div className={styles.lightbulb} ref={lightbulbRef}></div>
      </div>
    </>
  );
};
