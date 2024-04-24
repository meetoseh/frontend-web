import { useCallback, useMemo } from 'react';
import { Bezier } from '../lib/Bezier';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import { useMappedValueWithCallbacks } from '../hooks/useMappedValueWithCallbacks';
import { setVWC } from '../lib/setVWC';
import { useValueWithCallbacksEffect } from '../hooks/useValueWithCallbacksEffect';

export type DynamicAnimationDelayUntil =
  | {
      /**
       * Indicates we should wait a certain number of milliseconds before
       * starting this animation
       */
      type: 'ms';

      /**
       * The number of milliseconds to wait before starting this animation.
       */
      ms: number;
    }
  | {
      /**
       * Indicates we should start this animation at a timestamp which is
       * specified as relative to the start of another animation
       */
      type: 'relativeToStart';

      /**
       * The id of the other animation
       */
      id: string;

      /**
       * The timestamp to start this animation at, relative to the start
       * of the other animation. Must be non-negative
       */
      after: number;
    }
  | {
      /**
       * Indicates we should start this animation at a timestamp which is
       * specified as relative to the end of another animation
       */
      type: 'relativeToEnd';

      /**
       * The id of the other animation
       */
      id: string;

      /**
       * The timestamp to start this animation at, relative to the end
       * of the other animation. Must be non-negative
       */
      after: number;
    };

export type DynamicAnimationProgressEase =
  | { type: 'function'; fn: (progress: number) => number }
  | { type: 'bezier'; bezier: Bezier };

/**
 * Describes a single item within a sequence of animations that will
 * be played by the dynamic animation engine.
 */
export type DynamicAnimationEngineItemArg = {
  /** A unique identifier for this animation */
  id: string;

  /**
   * How long to wait before this animation starts, or undefined
   * to play this animation immediately
   */
  delayUntil?: DynamicAnimationDelayUntil;

  /**
   * The duration of this animation, in milliseconds
   */
  duration: number;

  /**
   * If specified, instead of using linear progress, we process the
   * linear progress through this easing function before passing
   * it to the onFrame callback
   */
  progressEase?: DynamicAnimationProgressEase;

  /**
   * Called when this animation needs to render.
   *
   * @param progress The progress of this animation, from 0 to 1
   * @param absoluteTime The time in milliseconds since the beginning of the animation group
   * @param relativeTime The time in milliseconds since the beginning of this animation
   */
  onFrame: (
    progress: number,
    absoluteTime: DOMHighResTimeStamp,
    relativeTime: DOMHighResTimeStamp
  ) => void;

  /**
   * Called just before the first call to onFrame. Useful if
   * setup is required for the animation
   */
  onStart?: () => void;

  /**
   * Called if we will no longer be calling onFrame for this animation.
   * This can happen if the animation is canceled, or if it finishes
   * normally.
   */
  onFinish?: (canceled: boolean) => void;
};

/**
 * Describes something that has at most one set of animations
 * at a time, such that calling play() will cancel any currently
 * playing animations and start the new ones.
 */
export type DynamicAnimationEngine = {
  /**
   * If animations are currently playing
   */
  playing: ValueWithCallbacks<boolean>;

  /**
   * Starts playing the given animations. If animations are already
   * playing, they will be canceled prior to starting the new
   * animations.
   *
   * @param animations The animations to play
   */
  play: (animations: DynamicAnimationEngineItemArg[]) => void;

  /**
   * If animations are currently playing they are canceled, otherwise
   * this does nothing.
   */
  stop: () => void;
};

/**
 * The persisted state we keep while executing animations. This is mutated
 * directly, but not stored in local variables so we can handle resuming
 * effects
 */
type EngineState = {
  /** The original animations, primarily for debugging */
  originalAnimations: DynamicAnimationEngineItemArg[];

  /** If we've had a frame, the last time we had a frame */
  lastFrameAt?: DOMHighResTimeStamp;

  /** The absolute time since the start of the animations */
  absoluteTime: DOMHighResTimeStamp;

  /** The animations we are currently playing */
  running: { startedAt: DOMHighResTimeStamp; animation: DynamicAnimationEngineItemArg }[];

  /**
   * The animations which we have managed to convert into an
   * absolute delay, in ascending order of ms. For an animation
   * which is e.g. queued to the start of another animation, when
   * that other animation is started we can then convert it to
   * an absolute delay and add it here.
   */
  animationsWithDelay: { ms: number; animation: DynamicAnimationEngineItemArg }[];

  /**
   * Contains animations which we have not run, have not yet converted
   * to an absolute delay, and which are relative to the start of
   * another animation, keyed by the id of the other animation. Each
   * value is an array of animations which are relative to the start
   * of the other animation in ascending order of ms.
   */
  animationsRelativeToStart: Map<
    string,
    (DynamicAnimationEngineItemArg & { delayUntil: { type: 'relativeToStart' } })[]
  >;

  /**
   * Contains animations which we have not run, have not yet converted
   * to an absolute delay, and which are relative to the end of
   * another animation, keyed by the id of the other animation. Each
   * value is an array of animations which are relative to the end
   * of the other animation in ascending order of ms.
   */
  animationsRelativeToEnd: Map<
    string,
    (DynamicAnimationEngineItemArg & { delayUntil: { type: 'relativeToEnd' } })[]
  >;
};

/**
 * Describes a very generic animation engine. This primarily handles combining
 * all of the animations into a single useAnimationFrame loop and processing
 * the progress of each animation.
 *
 * It is relatively challenging to use this compared to a more specific function
 * like `useAnimationTargetAndRendered`, however, this notably provides
 * functionality for chaining animations, e.g., rotate and then fade out. Although
 * this can be achieved by delaying changes to the target, it can often become
 * difficult to manage states and canceling timeouts properly.
 *
 * For simplicity, this omits defining the target or render function. This means
 * a bit more control, and a bit more boilerplate, for the caller.
 */
export const useDynamicAnimationEngine = (): DynamicAnimationEngine => {
  const engineVWC = useWritableValueWithCallbacks<EngineState | null>(() => null);
  const playing = useMappedValueWithCallbacks(engineVWC, (engine) => engine !== null);

  const play = useCallback(
    (animations: DynamicAnimationEngineItemArg[]) => {
      setVWC(
        engineVWC,
        {
          originalAnimations: animations,
          absoluteTime: 0,
          running: [],
          animationsWithDelay: animations
            .map((a) =>
              a.delayUntil === undefined
                ? { ms: 0, animation: a }
                : a.delayUntil.type === 'ms'
                ? { ms: a.delayUntil.ms, animation: a }
                : undefined
            )
            .filter((a): a is typeof a & object => a !== undefined),
          animationsRelativeToStart: (() => {
            const result = new Map<
              string,
              (DynamicAnimationEngineItemArg & { delayUntil: { type: 'relativeToStart' } })[]
            >();

            for (const anim of animations) {
              if (anim.delayUntil === undefined || anim.delayUntil.type !== 'relativeToStart') {
                continue;
              }

              const castedAnim = anim as DynamicAnimationEngineItemArg & {
                delayUntil: { type: 'relativeToStart' };
              };
              const existing = result.get(anim.delayUntil.id);
              if (existing === undefined) {
                result.set(anim.delayUntil.id, [castedAnim]);
              } else {
                existing.push(castedAnim);
              }
            }

            const iter = result.values();
            let next = iter.next();
            while (!next.done) {
              next.value.sort((a, b) => a.delayUntil.after - b.delayUntil.after);
              next = iter.next();
            }

            return result;
          })(),
          animationsRelativeToEnd: (() => {
            const result = new Map<
              string,
              (DynamicAnimationEngineItemArg & { delayUntil: { type: 'relativeToEnd' } })[]
            >();

            for (const anim of animations) {
              if (anim.delayUntil === undefined || anim.delayUntil.type !== 'relativeToEnd') {
                continue;
              }

              const castedAnim = anim as DynamicAnimationEngineItemArg & {
                delayUntil: { type: 'relativeToEnd' };
              };
              const existing = result.get(anim.delayUntil.id);
              if (existing === undefined) {
                result.set(anim.delayUntil.id, [castedAnim]);
              } else {
                existing.push(castedAnim);
              }
            }

            const iter = result.values();
            let next = iter.next();
            while (!next.done) {
              next.value.sort((a, b) => a.delayUntil.after - b.delayUntil.after);
              next = iter.next();
            }

            return result;
          })(),
        },
        () => false
      );
    },
    [engineVWC]
  );

  const stop = useCallback(() => {
    setVWC(engineVWC, null);
  }, [engineVWC]);

  useValueWithCallbacksEffect(engineVWC, (engineRaw) => {
    if (engineRaw === null) {
      return undefined;
    }
    const engine = engineRaw;

    let running = true;
    let animationRequest: ReturnType<typeof requestAnimationFrame> | undefined =
      requestAnimationFrame(onFrame);

    return () => {
      running = false;
      if (animationRequest !== undefined) {
        cancelAnimationFrame(animationRequest);
        animationRequest = undefined;
      }
    };

    async function onFrame(now: DOMHighResTimeStamp) {
      animationRequest = undefined;
      if (!running) {
        return;
      }

      try {
        if (processTick(now)) {
          animationRequest = requestAnimationFrame(onFrame);
        } else {
          setVWC(engineVWC, null);
        }
      } catch (e) {
        if (running) {
          console.log('canceling effect engine due to error:', e);
          setVWC(engineVWC, null);
        }
      }
    }

    function processTick(now: DOMHighResTimeStamp): boolean {
      const delta = engine.lastFrameAt === undefined ? 0 : now - engine.lastFrameAt;
      engine.lastFrameAt = now;
      engine.absoluteTime += delta;

      let newRunning: typeof engine.running | undefined = undefined;
      for (let wrapperIdx = 0; wrapperIdx < engine.running.length; wrapperIdx++) {
        const wrapper = engine.running[wrapperIdx];
        const relativeTime = engine.absoluteTime - wrapper.startedAt;
        const done = relativeTime >= wrapper.animation.duration;
        const linearProgress = done ? 1 : Math.min(relativeTime / wrapper.animation.duration, 1);
        const progress = done
          ? 1
          : applyProgressEase(wrapper.animation.progressEase, linearProgress);

        wrapper.animation.onFrame(progress, engine.absoluteTime, relativeTime);
        if (done) {
          if (newRunning === undefined) {
            newRunning = engine.running.slice(0, wrapperIdx);
          }

          wrapper.animation.onFinish?.(false);

          const toStart = engine.animationsRelativeToEnd.get(wrapper.animation.id);
          if (toStart !== undefined) {
            engine.animationsRelativeToEnd.delete(wrapper.animation.id);
            for (const subanim of toStart) {
              startAnimationAfterDelay(subanim, subanim.delayUntil.after, false);
            }
          }
        } else if (newRunning !== undefined) {
          newRunning.push(wrapper);
        }
      }

      if (newRunning !== undefined) {
        engine.running = newRunning;
      }

      while (
        engine.animationsWithDelay.length > 0 &&
        engine.animationsWithDelay[0].ms < engine.absoluteTime
      ) {
        const next = engine.animationsWithDelay.shift()!;
        startAnimationAfterDelay(next.animation, 0, true);
      }

      return engine.running.length !== 0 || engine.animationsWithDelay.length !== 0;
    }

    function startAnimationAfterDelay(
      anim: DynamicAnimationEngineItemArg,
      after: number,
      triggerFrame: boolean
    ) {
      if (after <= 0) {
        engine.running.push({ startedAt: engine.absoluteTime, animation: anim });
        anim.onStart?.();
        if (triggerFrame) {
          anim.onFrame(0, engine.absoluteTime, 0);
        }

        const toStart = engine.animationsRelativeToStart.get(anim.id);
        if (toStart !== undefined) {
          engine.animationsRelativeToStart.delete(anim.id);
          for (const subanim of toStart) {
            startAnimationAfterDelay(subanim, subanim.delayUntil.after, triggerFrame);
          }
        }
        return;
      }

      const absoluteStartTime = engine.absoluteTime + after;
      const insertIndex = engine.animationsWithDelay.findIndex((a) => a.ms > absoluteStartTime);
      if (insertIndex === -1) {
        engine.animationsWithDelay.push({ ms: absoluteStartTime, animation: anim });
      } else {
        engine.animationsWithDelay.splice(insertIndex, 0, {
          ms: absoluteStartTime,
          animation: anim,
        });
      }
    }
  });

  return useMemo(() => ({ playing, play, stop }), [playing, play, stop]);
};

function applyProgressEase(
  progressEase: DynamicAnimationProgressEase | undefined,
  progress: number
): number {
  if (progressEase === undefined) {
    return progress;
  }
  if (progressEase.type === 'function') {
    return progressEase.fn(progress);
  }

  return progressEase.bezier.y_x(progress);
}
