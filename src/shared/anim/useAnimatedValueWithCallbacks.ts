import { MutableRefObject, useEffect, useMemo, useRef } from 'react';
import { WritableValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import { Animator, useAnimationLoop } from './AnimationLoop';
import { VariableStrategyProps } from './VariableStrategyProps';

/**
 * Creates a new writable value with callbacks and uses it to push
 * changes to an animation loop powered by the given render function.
 *
 * @param initialValue The initial state to render the component with.
 * @param animators The animators to use to animate the value. If specified
 *   as a function the function is only ever called once and the returned
 *   value is used for the lifetime of the component. If specified directly
 *   as an array, the value must be memoized.
 * @param render The function which can take a state value and render it,
 *   called once per frame when awake (see `useAnimationLoop`)
 */
export const useAnimatedValueWithCallbacks = <T extends object>(
  initialValue: T,
  animators: Animator<T>[] | (() => Animator<T>[]),
  render: (value: T) => void
): WritableValueWithCallbacks<T> => {
  const target = useWritableValueWithCallbacks(() => initialValue);
  const targetAsVariableStrategyProps = useMemo<VariableStrategyProps<T>>(
    () => ({
      type: 'callbacks',
      props: () => target.get(),
      callbacks: target.callbacks,
    }),
    [target]
  );

  const animatorsRef = useRef<Animator<T>[]>();
  if (typeof animators === 'function') {
    if (animatorsRef.current === undefined) {
      animatorsRef.current = animators();
    }
  } else {
    animatorsRef.current = animators;
  }

  const [rendered, renderedCallbacks] = useAnimationLoop(
    targetAsVariableStrategyProps,
    animatorsRef.current
  );

  const renderRef = useRef<(value: T) => void>() as MutableRefObject<(value: T) => void>;
  renderRef.current = render;

  useEffect(() => {
    renderedCallbacks.add(doRender);
    doRender();
    return () => {
      renderedCallbacks.remove(doRender);
    };

    function doRender() {
      renderRef.current(rendered());
    }
  }, [rendered, renderedCallbacks]);

  return target;
};
