import { MutableRefObject, RefObject, useEffect, useRef } from 'react';
import { Callbacks } from '../lib/Callbacks';
import { createCancelablePromiseFromCallbacks } from '../lib/createCancelablePromiseFromCallbacks';
import { createCancelableTimeout } from '../lib/createCancelableTimeout';

type SimpleAnimationProps<T, S> = {
  /**
   * The ref object which points to the element to be animated,
   * typically an HTMLDivElement
   */
  ref: RefObject<T> | MutableRefObject<T | undefined>;

  /**
   * The delay in milliseconds before the animation starts. Only
   * progresses while the animation is not paused. This is only
   * read when the component is constructed.
   */
  delay: number;

  /**
   * True if the animation is paused, false otherwise.
   */
  paused: boolean;

  /**
   * If specified, called when the animation is started.
   */
  onStarted?: () => void;

  /**
   * If specified, called when the animation is finished.
   */
  onFinished?: () => void;

  /**
   * Prepares the state to be rendered at the given time into the animation.
   * Returns a state object which will be passed to the other functions.
   *
   * If necessary, this can also modify the target to prepare it for the
   * animation. This may depend on the animation time. Note, however, that
   * render is always called immediately after initialization, so for simple
   * animations initialize can ignore the animation time and set the state to as
   * if it were animation time zero. The most common example where the animation
   * time needs to be considered in initialize is for multi-part animations,
   * where render is only modifying one part of the animation at a time. In that
   * case, if remounted in a later part, initialize should be able to pick up
   * where it left off.
   *
   * Changing this function will remount the animation, so it should be stable.
   */
  initialize: (ref: T, animationTime: number) => S;

  /**
   * Renders into the given target using the given state for the given time.
   * This function should not modify the state.
   *
   * Changing this function will remount the animation, so it should be stable.
   */
  render: (ref: T, state: S, animationTime: number) => void;

  /**
   * Updates the state for the given time. Returns true if the animation
   * should continue, false otherwise.
   * This function should not modify the target.
   *
   * Changing this function will remount the animation, so it should be stable.
   */
  tick: (ref: T, state: S, animationTime: number) => boolean;

  /**
   * Disposes of any unmanaged resources, such as webgl resources or images.
   * After this is called, it should be safe to call initialize again.
   *
   * Changing this function will remount the animation, so it should be stable.
   */
  dispose: (ref: T, state: S) => void;
};

/**
 * Provides the standard glue code used for a requestAnimationFrame based animation.
 * This will ensure the following:
 *
 * - Exactly one handler is managing the ref, i.e., initialize() is always followed
 *   by dispose before another initialize()
 * - The handler is only called when the ref is available
 * - Dispose is always called when the effect is unmounted
 * - Dispose is not called until the effect is unmounted, even if the animation is finished
 * - Dispose is called at the next frame if unmounted while the animation is running, rather
 *   than immediately
 * - remounting the component while the animation is playing will not typically result in
 *   a missed frame, which is a common issue with requestAnimationFrame effects.
 */
export function useSimpleAnimation<T, S>(props: SimpleAnimationProps<T, S>) {
  const locked = useRef<boolean>(false);
  const remounting = useRef<boolean>(false);
  const remountingCounter = useRef<number>(0);
  const lockedCallbacks = useRef<Callbacks<undefined>>() as MutableRefObject<Callbacks<undefined>>;

  if (lockedCallbacks.current === undefined) {
    lockedCallbacks.current = new Callbacks<undefined>();
  }

  const delayRemaining = useRef<number>(props.delay);
  const animationTime = useRef<number>(0);

  const haveStarted = useRef<boolean>(false);
  const haveFinished = useRef<boolean>(false);

  const onStartedRef = useRef(props.onStarted);
  const onFinishedRef = useRef(props.onFinished);

  onStartedRef.current = props.onStarted;
  onFinishedRef.current = props.onFinished;

  const initialize = props.initialize;
  const render = props.render;
  const tick = props.tick;
  const dispose = props.dispose;

  useEffect(() => {
    if (props.ref.current === null || props.ref.current === undefined) {
      return;
    }

    const ref = props.ref.current;
    let active = true;
    const cancelers = new Callbacks<undefined>();
    acquireLockAndHandle();
    return () => {
      if (active) {
        active = false;
        cancelers.call(undefined);
      }
    };

    async function acquireLockAndHandle() {
      const id = ++remountingCounter.current;
      remounting.current = true;
      while (locked.current && active) {
        const canceled = createCancelablePromiseFromCallbacks(cancelers);
        const prevUnmounted = createCancelablePromiseFromCallbacks(lockedCallbacks.current);
        await Promise.race([canceled.promise, prevUnmounted.promise]);
        canceled.cancel();
        prevUnmounted.cancel();
      }

      if (remountingCounter.current === id) {
        remounting.current = false;
      }

      if (!active) {
        return;
      }

      locked.current = true;
      handle();
    }

    function releaseLock() {
      locked.current = false;
      lockedCallbacks.current.call(undefined);
    }

    async function handle() {
      const state = initialize(ref, animationTime.current);
      render(ref, state, animationTime.current);

      if (props.paused) {
        return;
      }

      if (delayRemaining.current > 0) {
        const startedAt = Date.now();
        const delayFinished = createCancelableTimeout(delayRemaining.current);
        const canceled = createCancelablePromiseFromCallbacks(cancelers);
        await Promise.race([delayFinished.promise, canceled.promise]);
        if (delayFinished.done()) {
          delayRemaining.current = 0;
        } else {
          delayRemaining.current = Math.max(0, delayRemaining.current - (Date.now() - startedAt));
        }
        delayFinished.cancel();
        canceled.cancel();
        if (!active) {
          dispose(ref, state);
          releaseLock();
          return;
        }
      }

      if (!haveStarted.current) {
        haveStarted.current = true;
        onStartedRef.current?.();
      }

      if (haveFinished.current) {
        cancelers.add(() => {
          dispose(ref, state);
          releaseLock();
        });
        return;
      }

      playAnimation(state);
    }

    async function playAnimation(state: S) {
      const startedAt: DOMHighResTimeStamp = performance.now();
      let lastFrameAt: DOMHighResTimeStamp | null = null;

      const onFrame = (now: DOMHighResTimeStamp) => {
        if (!active && !remounting) {
          dispose(ref, state);
          releaseLock();
          return;
        }

        const delta = lastFrameAt === null ? performance.now() - startedAt : now - lastFrameAt;
        lastFrameAt = now;

        animationTime.current += delta;
        const shouldContinue = tick(ref, state, animationTime.current);
        render(ref, state, animationTime.current);

        if (!shouldContinue) {
          haveFinished.current = true;
          onFinishedRef.current?.();
        }

        if (!active) {
          dispose(ref, state);
          releaseLock();
          return;
        }

        if (shouldContinue) {
          requestAnimationFrame(onFrame);
        } else {
          cancelers.add(() => {
            dispose(ref, state);
            releaseLock();
          });
        }
      };

      requestAnimationFrame(onFrame);
    }
  }, [props.ref, props.paused, initialize, render, tick, dispose]);
}
