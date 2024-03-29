import { MutableRefObject, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../lib/Callbacks';
import { createCancelablePromiseFromCallbacks } from './createCancelablePromiseFromCallbacks';
import { CancelablePromise } from './CancelablePromise';
import { constructCancelablePromise } from './CancelablePromiseConstructor';
import { setVWC } from './setVWC';
import { useValueWithCallbacksEffect } from '../hooks/useValueWithCallbacksEffect';
import { DynamicAnimationEngine } from '../anim/useDynamicAnimation';

/**
 * A standard way for a component to expose configurable entrance and exit
 * transitions.
 *
 * `T` is typically a string enum dictating the type of transition, e.g.,
 * `swipe`, `fade`, etc. Then `C` is generally a union type discriminated
 * by `type` that contains the necessary information for the transition,
 * for example:
 *
 * ```ts
 * { type: 'swipe', direction: 'to-left' | 'to-right', ms: number }
 *   | { type: 'fade', ms: number }
 * ```
 *
 * Then the visible property is a boolean that dictates whether the component
 * should be currently visible or not. Generally, for transitions, visible starts
 * false, then setVWC(visible, true) will trigger the entrance transition, and
 * setVWC(visible, false) will trigger the exit transition. The caveat is that
 * the visible property should not be set to `true` until `ready` is also `true`,
 * or the entrance transition will not be triggered.
 *
 * While `animating` is true, the component is transitioning. In order to avoid
 * cutting off the exit animation, the component needs to linger after setting
 * `visible` to `false` until `animating` is also `false`.
 *
 * EXAMPLE:
 *
 * ```tsx
 * type FooTransition = { type: 'swipe'; direction: 'to-left' | 'to-right'; ms: number };
 * declare const Foo: (props: {
 *   transition: TransitionProp<FooTransition['type'], FooTransition>;
 * }) => ReactElement;
 *
 * const MyComponent = () => {
 *   const fooTransition = useTransitionProp((): FooTransition => ({ type: 'swipe', direction: 'to-left', ms: 500 }));
 *   useEntranceTransition(fooTransition);
 *
 *   // When you're ready to leave...
 *   const handleExit = async () => {
 *     await playExitTransition(fooTransition).promise.catch(() => {});
 *     // ... unmount ...
 *   }
 *
 *   return <Foo transition={fooTransition} />;
 * }
 * ```
 *
 * This type is defined from the perspective of what the component that accepts
 * the `TransitionProp` should expect to receive. They will never modify `animation`
 * or `visible` and will assume nothing else modifies `ready` or `animating`.
 */
export type TransitionProp<T extends string, C extends { type: T; ms: number }> = {
  /** Configures the type of animation that should play */
  animation: ValueWithCallbacks<C>;
  /** Configures if the component should be in the visible state or not */
  visible: ValueWithCallbacks<boolean>;
  /** If the component is playing animations according to visible yet or not. */
  ready: WritableValueWithCallbacks<boolean>;
  /** If the component is playing an animation right now or not */
  animating: WritableValueWithCallbacks<boolean>;
};

/**
 * The result of `useTransitionProp`, which provides a fully writable version
 */
export type TransitionPropAsInitialized<T extends string, C extends { type: T; ms: number }> = {
  animation: WritableValueWithCallbacks<C>;
  visible: WritableValueWithCallbacks<boolean>;
  ready: WritableValueWithCallbacks<boolean>;
  animating: WritableValueWithCallbacks<boolean>;
};

/**
 * The TransitionProp from the perspective of the owner, where animation and visible
 * are writable but ready and animating are not. This is solely for more accurate type
 * hints.
 *
 * For "ideal" typing, you can do:
 *
 * ```ts
 * const transitionRaw = useTransitionProp(() => ({ type: 'swipe', direction: 'to-left', ms: 500 }));
 * const transition = safeTransition(transitionRaw); // this is just a type cast
 *
 * // transition.ready.set will be disallowed (that's for the component that accepts the TransitionProp)
 * ```
 */
export type TransitionPropAsOwner<T extends string, C extends { type: T; ms: number }> = {
  animation: WritableValueWithCallbacks<C>;
  visible: WritableValueWithCallbacks<boolean>;
  ready: ValueWithCallbacks<boolean>;
  animating: ValueWithCallbacks<boolean>;
};

export const safeTransition = <T extends string, C extends { type: T; ms: number }>(
  dangerous: TransitionPropAsInitialized<T, C>
): TransitionPropAsOwner<T, C> => dangerous;

/**
 * Used by a component which contains a component that accepts a `TransitionProp`
 * to manage constructing the TransitionProp argument
 *
 * @param config Configures the type of
 */
export const useTransitionProp = <T extends string, C extends { type: T; ms: number }>(
  config: () => C
): TransitionPropAsInitialized<T, C> => {
  const animation = useWritableValueWithCallbacks(config);
  const visible = useWritableValueWithCallbacks(() => false);
  const ready = useWritableValueWithCallbacks(() => false);
  const animating = useWritableValueWithCallbacks(() => false);

  return useMemo(
    () => ({ animation, visible, ready, animating }),
    [animation, visible, ready, animating]
  );
};

/**
 * Used by a component which accepts an optional transition prop so that it can
 * always be treated as an initialized transition prop. Usually, if you do this
 * it makes sense to include a 'none' option for the configuration, and to initialize
 * to that.
 *
 * This will handle updating the returned value if the prop changes meaningfully,
 * which helps when using the dev server that can trigger rerenders where they would
 * not otherwise be possible.
 */
export const useInitializedTransitionProp = <T extends string, C extends { type: T; ms: number }>(
  prop: TransitionProp<T, C> | undefined,
  defaultConfig: () => C
): TransitionProp<T, C> => {
  const expecting = useRef<TransitionProp<T, C> | undefined>(undefined);
  const initialized = useRef<TransitionProp<T, C>>(null) as MutableRefObject<TransitionProp<T, C>>;
  if (initialized.current === null) {
    expecting.current = prop;
    if (prop === undefined) {
      initialized.current = {
        animation: createWritableValueWithCallbacks(defaultConfig()),
        visible: createWritableValueWithCallbacks(false),
        ready: createWritableValueWithCallbacks(false),
        animating: createWritableValueWithCallbacks(false),
      };
    } else {
      initialized.current = prop;
    }
  } else {
    const exp = expecting.current;
    if (exp === undefined && prop !== undefined) {
      expecting.current = prop;
      initialized.current = prop;
    } else if (exp !== undefined && prop === undefined) {
      expecting.current = undefined;
      initialized.current = {
        animation: createWritableValueWithCallbacks(defaultConfig()),
        visible: createWritableValueWithCallbacks(false),
        ready: createWritableValueWithCallbacks(false),
        animating: createWritableValueWithCallbacks(false),
      };
    } else if (exp !== undefined && prop !== undefined && expecting.current !== prop) {
      if (
        exp.animation !== prop.animation ||
        exp.visible !== prop.visible ||
        exp.ready !== prop.ready ||
        exp.animating !== prop.animating
      ) {
        initialized.current = prop;
      }
      expecting.current = prop;
    }
  }
  return initialized.current;
};

/**
 * Plays the entrance transition on the underlying component that was forwarded
 * the transition prop. This is called by the component that initialized the
 * transition prop.
 *
 * Cancelling the returned promise will not cancel the transition. It is intended
 * to convey that the component that is receiving the transition prop is expected
 * to be unmounted and thus may not be managing the ready/animating states. Without
 * cancellation this will indefinitely poll for e.g. ready to become true.
 *
 * Prefer `useEntranceTransition` to ensure this promise is never leaked.
 */
export const playEntranceTransition = <T extends string, C extends { type: T; ms: number }>(
  transition: TransitionPropAsOwner<T, C>,
  opts?: {
    /**
     * When the promise should resolve. Defaults to animation-ended
     */
    returnWhen: 'animation-started' | 'animation-ended';
  }
): CancelablePromise<void> => {
  const returnWhen = opts?.returnWhen ?? 'animation-ended';

  return constructCancelablePromise({
    body: async (state, resolve, reject) => {
      const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
      canceled.promise.catch(() => {});
      if (state.finishing) {
        canceled.cancel();
        state.done = true;
        reject(new Error('canceled'));
        return;
      }
      if (transition.visible.get()) {
        canceled.cancel();
        state.finishing = true;
        state.done = true;
        reject(new Error('already visible'));
        return;
      }

      if (!transition.ready.get()) {
        while (true) {
          if (state.finishing) {
            canceled.cancel();
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          const readyChanged = createCancelablePromiseFromCallbacks(transition.ready.callbacks);
          readyChanged.promise.catch(() => {});
          if (transition.ready.get()) {
            readyChanged.cancel();
            break;
          }
          await Promise.race([readyChanged.promise, canceled.promise]);
          readyChanged.cancel();
        }
      }

      if (transition.visible.get()) {
        canceled.cancel();
        state.finishing = true;
        state.done = true;
        reject(new Error('something else set visible'));
        return;
      }

      if (transition.animating.get()) {
        canceled.cancel();
        state.finishing = true;
        state.done = true;
        reject(new Error('already animating'));
        return;
      }

      setVWC(transition.visible, true);
      if (returnWhen === 'animation-started') {
        canceled.cancel();
        state.finishing = true;
        state.done = true;
        resolve();
        return;
      }

      while (true) {
        if (state.finishing) {
          canceled.cancel();
          state.done = true;
          reject(new Error('canceled'));
          return;
        }

        const animatingChanged = createCancelablePromiseFromCallbacks(
          transition.animating.callbacks
        );
        animatingChanged.promise.catch(() => {});
        if (!transition.animating.get()) {
          animatingChanged.cancel();
          break;
        }

        await Promise.race([animatingChanged.promise, canceled.promise]);
        animatingChanged.cancel();
      }

      canceled.cancel();
      state.finishing = true;
      state.done = true;
      resolve();
    },
  });
};

/**
 * Plays the entrance transition as soon as possible, unless blocked is specified,
 * in which case plays the transition once blocked becomes false (if it doesn't start
 * false, which has the same effect as not specifying blocked). Note that setting
 * blocked back to true once its been seen false has no effect.
 */
export const useEntranceTransition = <T extends string, C extends { type: T; ms: number }>(
  transition: TransitionPropAsOwner<T, C>,
  blocked?: ValueWithCallbacks<boolean>
): void => {
  const playedRef = useRef<boolean>(false);
  const unblocked = useWritableValueWithCallbacks(() => blocked === undefined || !blocked.get());

  useEffect(() => {
    if (blocked === undefined) {
      setVWC(unblocked, true);
      return;
    }

    const vwc = blocked;
    vwc.callbacks.add(handleBlockedChanged);
    return () => {
      vwc.callbacks.remove(handleBlockedChanged);
    };

    function handleBlockedChanged() {
      if (!vwc.get()) {
        setVWC(unblocked, true);
        vwc.callbacks.remove(handleBlockedChanged);
      }
    }
  }, [blocked]);

  useValueWithCallbacksEffect(
    unblocked,
    useCallback(
      (unblocked) => {
        if (!unblocked) {
          return;
        }

        if (playedRef.current) {
          return;
        }

        let active = true;
        const entrance = playEntranceTransition(transition, { returnWhen: 'animation-started' });
        entrance.promise.catch(() => {});
        return () => {
          if (active) {
            active = false;
            if (entrance.done()) {
              playedRef.current = true;
            }
            entrance.cancel();
          }
        };
      },
      [transition]
    )
  );
};

/**
 * Plays the exit transition on the underlying component. If the component is
 * not ready, resolves immediately (if it was never mounted its best to just
 * skip the whole animation process). Otherwise, sets visible to false (if not
 * already false) and (optionally) waits for the animation to complete OR the
 * component to become unmounted (ready to become false). This means it's
 * generally difficult to leak this promise across mounts.
 */
export const playExitTransition = <T extends string, C extends { type: T; ms: number }>(
  transition: TransitionPropAsOwner<T, C>,
  opts?: {
    /**
     * When the promise should resolve. Defaults to animation-ended
     */
    returnWhen: 'animation-started' | 'animation-ended';
  }
): CancelablePromise<void> => {
  const returnWhen = opts?.returnWhen ?? 'animation-ended';

  return constructCancelablePromise({
    body: async (state, resolve, reject) => {
      const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
      canceled.promise.catch(() => {});
      if (state.finishing) {
        canceled.cancel();
        state.done = true;
        reject(new Error('canceled'));
        return;
      }

      if (!transition.ready.get()) {
        canceled.cancel();
        state.finishing = true;
        state.done = true;
        resolve();
        return;
      }

      setVWC(transition.visible, false);
      if (returnWhen === 'animation-started') {
        canceled.cancel();
        state.finishing = true;
        state.done = true;
        resolve();
        return;
      }

      while (true) {
        if (state.finishing) {
          canceled.cancel();
          state.done = true;
          reject(new Error('canceled'));
          return;
        }

        const animatingChanged = createCancelablePromiseFromCallbacks(
          transition.animating.callbacks
        );
        animatingChanged.promise.catch(() => {});
        if (!transition.animating.get()) {
          animatingChanged.cancel();
          break;
        }

        const readyChanged = createCancelablePromiseFromCallbacks(transition.ready.callbacks);
        readyChanged.promise.catch(() => {});
        if (!transition.ready.get()) {
          animatingChanged.cancel();
          readyChanged.cancel();
          break;
        }

        await Promise.race([animatingChanged.promise, readyChanged.promise, canceled.promise]);
        animatingChanged.cancel();
        readyChanged.cancel();
      }

      canceled.cancel();
      state.finishing = true;
      state.done = true;
      resolve();
    },
  });
};

/**
 * When driving a transition prop via a dynamic engine, which is a natural setup,
 * the `engine.playing` value maps directly to the `transition.animating` value.
 * This handles setting up that mapping.
 */
export const useAttachDynamicEngineToTransition = <
  T extends string,
  C extends { type: T; ms: number }
>(
  transition: TransitionProp<T, C>,
  engine: DynamicAnimationEngine
): void => {
  useValueWithCallbacksEffect(engine.playing, (p) => {
    setVWC(transition.animating, p);
    return undefined;
  });
};

/**
 * Used by the component receiving the transition prop to run the onEnter callback
 * when the specified type of transition enters and the onExit callback when the
 * specified type of transition exits.
 *
 * react has a hook called `useTransition` which is not that useful for us since
 * it's related to SSR, but to avoid a name conflict we call this
 * `useOsehTransition`.
 */
export const useOsehTransition = <
  T extends string,
  MyT extends T,
  C extends { type: T; ms: number }
>(
  transition: TransitionProp<T, C>,
  type: MyT,
  onEnter: (cfg: C & { type: MyT }) => void,
  onExit: (cfg: C & { type: MyT }) => void
) => {
  const onEnterRef = useRef(onEnter);
  const onExitRef = useRef(onExit);

  onEnterRef.current = onEnter;
  onExitRef.current = onExit;

  useValueWithCallbacksEffect(
    transition.animation,
    useCallback(
      (cfgUnch) => {
        if (cfgUnch.type !== type) {
          return undefined;
        }
        const cfg = cfgUnch as C & { type: MyT };

        let wasVisible = transition.visible.get();
        transition.visible.callbacks.add(handleVisibleChanged);
        return () => {
          transition.visible.callbacks.remove(handleVisibleChanged);
        };

        function handleVisibleChanged() {
          const nowVisible = transition.visible.get();
          if (wasVisible && !nowVisible) {
            onExitRef.current(cfg);
          } else if (!wasVisible && nowVisible) {
            onEnterRef.current(cfg);
          }
          wasVisible = nowVisible;
        }
      },
      [transition.visible, type]
    )
  );
};

/**
 * Used by the component receiving the transition prop after setting up all the
 * visible and configuration callbacks (usually via `useTransition`) to set the
 * `ready` property to true, and false when unmounted.
 */
export const useSetTransitionReady = <T extends string, C extends { type: T; ms: number }>(
  transition: TransitionProp<T, C>
): void => {
  useEffect(() => {
    setVWC(transition.ready, true);
    return () => {
      setVWC(transition.ready, false);
    };
  }, [transition]);
};
