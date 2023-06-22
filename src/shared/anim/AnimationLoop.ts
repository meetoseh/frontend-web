import { MutableRefObject, useCallback, useEffect, useMemo, useRef } from 'react';
import { Bezier } from '../lib/Bezier';
import { BezierAnimation, animIsComplete, calculateAnimValue } from '../lib/BezierAnimation';
import { Callbacks } from '../lib/Callbacks';

export interface Animator<P extends object> {
  /**
   * Called when the animator is currently sleeping. Determines if the
   * animator should start running, based on if the rendered value
   * differs from the current value.
   *
   * @param rendered The props that have most recently been rendered.
   * @param target The props that we're supposed to be animating to.
   * @returns True if the animator should be awoken, false otherwise.
   */
  maybeAwaken(rendered: P, target: P): boolean;

  /**
   * Called once per frame until the animator is complete. Returns
   * 'done' if the animator should go to sleep because the part it
   * handles now matches its target. Returns 'continue' if the animator
   * should continue running.
   *
   * @param toRender The props that we are about to render. Should be
   *   mutated by the animator.
   * @param target The props that we're supposed to be animating to.
   * @param now An arbitrary monotonic timestamp which should only be
   *   compared with other values passed to this function. Monotonicity
   *   is not guarranteed between different awake periods.
   * @returns 'done' to complete the awake period, which will cause
   *   `maybeAwaken` to be called when the target changes but no further
   *   applications until `maybeAwaken` returns true. Returns 'continue'
   *   to continue the awake period, which will cause `apply` to be
   *   called again on the next frame.
   */
  apply(toRender: P, target: P, now: DOMHighResTimeStamp): 'done' | 'continue';

  /**
   * Should reset the animator, called when we are forced to cancel an
   * apply cycle, for example, because the animators changed. After this,
   * maybeAwaken will be called again.
   */
  reset(): void;
}

/**
 * The trivial animator for a single field in the props. This animator
 * will always animate the field to the target value in a single frame.
 */
export class TrivialAnimator<K extends string, T, P extends { [key in K]: T }>
  implements Animator<P>
{
  private readonly key: K;

  constructor(key: K) {
    this.key = key;
  }

  maybeAwaken(rendered: P, target: P): boolean {
    return rendered[this.key] !== target[this.key];
  }

  apply(toRender: P, target: P, now: DOMHighResTimeStamp): 'done' | 'continue' {
    toRender[this.key] = target[this.key];
    return 'done';
  }

  reset(): void {}
}

type StdAnimatorOpts = {
  /**
   * What to do if the target changes while animating. We will need to
   * recreate the animation easing, but the question comes with what to
   * do with the duration: should we have the animation complete at the
   * original time, or should it complete later?
   *
   * Generally this is not a subjective choice; if the target changes
   * often and smoothly, replace is appropriate. Otherwise, extend is
   * appropriate.
   *
   * @default true
   */
  onTargetChange?: 'extend' | 'replace';
};

const defaultAnimatorOpts: Required<StdAnimatorOpts> = {
  onTargetChange: 'extend',
};

/**
 * Uses a Bezier animation curve for a single number field in the props.
 * This animator will animate the field from the rendered value to the
 * target value over the specified duration, extending the duration
 * if the target changes while the animation is in progress.
 *
 * The setter constructor argument is only because I can't find a way
 * in typescript to say that P is an object that supports P[K] = number.
 */
export class BezierAnimator<P extends object> implements Animator<P> {
  private readonly ease: Bezier;
  private readonly duration: number;
  private readonly getter: (p: P) => number;
  private readonly setter: (p: P, v: number) => void;
  private readonly opts: Required<StdAnimatorOpts>;

  private animation: BezierAnimation | null;

  constructor(
    ease: Bezier,
    duration: number,
    getter: (p: P) => number,
    setter: (p: P, v: number) => void,
    opts?: StdAnimatorOpts
  ) {
    this.ease = ease;
    this.duration = duration;
    this.getter = getter;
    this.setter = setter;
    this.opts = Object.assign({}, defaultAnimatorOpts, opts);

    this.animation = null;
  }

  maybeAwaken(rendered: P, target: P): boolean {
    return this.getter(rendered) !== this.getter(target);
  }

  apply(toRender: P, target: P, now: DOMHighResTimeStamp): 'done' | 'continue' {
    if (this.animation === null && this.getter(toRender) === this.getter(target)) {
      return 'done';
    }

    if (this.animation !== null && this.animation.to !== this.getter(target)) {
      this.animation = {
        startedAt: this.opts.onTargetChange === 'extend' ? now : this.animation.startedAt,
        from: this.opts.onTargetChange === 'extend' ? this.getter(toRender) : this.animation.from,
        to: this.getter(target),
        ease: this.ease,
        duration: this.duration,
      };

      if (animIsComplete(this.animation, now)) {
        this.animation = null;
      }
    }

    if (this.animation === null) {
      this.animation = {
        startedAt: now,
        from: this.getter(toRender),
        to: this.getter(target),
        ease: this.ease,
        duration: this.duration,
      };
    }

    if (animIsComplete(this.animation, now)) {
      this.setter(toRender, this.getter(target));
      this.animation = null;
      return 'done';
    }

    this.setter(toRender, calculateAnimValue(this.animation, now));
    return 'continue';
  }

  reset(): void {
    this.animation = null;
  }
}

type RGBAColor = [number, number, number, number];

const colorEq = (a: RGBAColor, b: RGBAColor): boolean => {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
};

const colorEase = (a: RGBAColor, b: RGBAColor, t: number): RGBAColor => {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ];
};

/**
 * Uses a Bezier animation curve for a color specified as [r,g,b,a] 0-1 scale
 * in the props.
 */
export class BezierColorAnimator<P extends object> implements Animator<P> {
  private readonly ease: Bezier;
  private readonly duration: number;
  private readonly getter: (p: P) => RGBAColor;
  private readonly setter: (p: P, v: RGBAColor) => void;

  private animation: (BezierAnimation & { startColor: RGBAColor; endColor: RGBAColor }) | null;

  constructor(
    ease: Bezier,
    duration: number,
    getter: (p: P) => RGBAColor,
    setter: (p: P, v: RGBAColor) => void
  ) {
    this.ease = ease;
    this.duration = duration;
    this.getter = getter;
    this.setter = setter;

    this.animation = null;
  }

  maybeAwaken(rendered: P, target: P): boolean {
    return !colorEq(this.getter(rendered), this.getter(target));
  }

  apply(toRender: P, target: P, now: DOMHighResTimeStamp): 'done' | 'continue' {
    if (this.animation === null && colorEq(this.getter(toRender), this.getter(target))) {
      return 'done';
    }

    if (this.animation !== null && !colorEq(this.animation.endColor, this.getter(target))) {
      this.animation = null;
    }

    if (this.animation === null) {
      this.animation = {
        startedAt: now,
        startColor: [...this.getter(toRender)],
        endColor: [...this.getter(target)],
        from: 0,
        to: 1,
        ease: this.ease,
        duration: this.duration,
      };
    }

    if (animIsComplete(this.animation, now)) {
      this.setter(toRender, [...this.animation.endColor]);
      this.animation = null;
      return 'done';
    }

    this.setter(
      toRender,
      colorEase(
        this.animation.startColor,
        this.animation.endColor,
        calculateAnimValue(this.animation, now)
      )
    );
    return 'continue';
  }

  reset(): void {
    this.animation = null;
  }
}

export type VariableStrategyProps<P extends object> =
  | { type: 'react-rerender'; props: P }
  | { type: 'callbacks'; props: () => P; callbacks: Callbacks<undefined> };

/**
 * Implements a basic animation loop separate from the actual rendering
 * logic, where "animating" in this context is progressively changing
 * the props and firing callbacks. If the animators are specified correctly,
 * the returned props will tend towards the specified target props.
 *
 * @param props The props that we are currently targeting. Memoizing this value
 *   is not required.
 * @param animators The animators that will be used to animate the props.
 * @returns A function which can be used to get the current props to render,
 *   and the callbacks which are called whenever the rendered props change.
 */
export const useAnimationLoop = <P extends object>(
  props: VariableStrategyProps<P>,
  animators: Animator<P>[]
): [() => P, Callbacks<undefined>] => {
  const target = useRef<P>() as MutableRefObject<P>;
  const rendered = useRef<P>() as MutableRefObject<P>;
  const onTargetChanged = useRef<Callbacks<undefined>>() as MutableRefObject<Callbacks<undefined>>;
  const onRenderedChanged = useRef<Callbacks<undefined>>() as MutableRefObject<
    Callbacks<undefined>
  >;

  if (rendered.current === undefined) {
    if (props.type === 'react-rerender') {
      rendered.current = Object.assign({}, props.props);
    } else {
      rendered.current = Object.assign({}, props.props());
    }
  }

  if (onTargetChanged.current === undefined) {
    onTargetChanged.current = new Callbacks();
  }

  if (onRenderedChanged.current === undefined) {
    onRenderedChanged.current = new Callbacks();
  }

  if (props.type === 'react-rerender' && target.current !== props.props) {
    target.current = props.props;
    onTargetChanged.current.call(undefined);
  }

  const propCallbacks = props.type === 'callbacks' ? props.callbacks : undefined;
  useEffect(() => {
    if (props.type !== 'callbacks' || propCallbacks === undefined) {
      return;
    }

    const handlePropsChanged = () => {
      target.current = props.props.call(undefined);
      onTargetChanged.current.call(undefined);
    };

    propCallbacks.add(handlePropsChanged);
    handlePropsChanged();

    return () => {
      propCallbacks.remove(handlePropsChanged);
    };
  }, [props.type, propCallbacks, props.props]);

  useEffect(() => {
    const statuses = animators.map((a) => a.maybeAwaken(rendered.current, target.current));
    let animating = statuses.some((s) => s);
    let active = true;

    const loop = (now: DOMHighResTimeStamp) => {
      if (!active) {
        animating = false;
        return;
      }

      let stillAnimating = false;
      for (let i = 0; i < animators.length; i++) {
        if (statuses[i]) {
          const newStatus = animators[i].apply(rendered.current, target.current, now);
          if (newStatus !== 'continue') {
            statuses[i] = false;
          } else {
            stillAnimating = true;
          }
        }
      }

      onRenderedChanged.current.call(undefined);
      animating = stillAnimating;
      if (animating) {
        requestAnimationFrame(loop);
      }
    };

    const handleTargetChanged = () => {
      if (!active) {
        return;
      }

      let maybeStartAnimating = false;
      for (let i = 0; i < animators.length; i++) {
        if (!statuses[i] && animators[i].maybeAwaken(rendered.current, target.current)) {
          statuses[i] = true;
          maybeStartAnimating = true;
        }
      }

      if (maybeStartAnimating && !animating) {
        animating = true;
        requestAnimationFrame(loop);
      }
    };

    if (animating) {
      requestAnimationFrame(loop);
    }
    onTargetChanged.current.add(handleTargetChanged);

    return () => {
      if (!active) {
        return;
      }
      active = false;
      onTargetChanged.current.remove(handleTargetChanged);

      for (let i = 0; i < animators.length; i++) {
        if (statuses[i]) {
          animators[i].reset();
        }
      }
    };
  }, [animators]);

  const getRendered = useCallback(() => rendered.current, []);
  return useMemo(() => [getRendered, onRenderedChanged.current], [getRendered]);
};
