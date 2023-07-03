import { useEffect } from 'react';
import { Callbacks, ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';

/**
 * For components which can be used both using standard react state or
 * via callbacks (to avoid react rerenders), this is a union type which
 * allows the caller to specify which strategy to use. It's more convenient
 * for the callee to use this type rather than always having to promote their
 * props to a ValueWithCallbacks. The useVariableStrategyPropsAsValueWithCallbacks
 * will allow the implementation function to promote it on the callee's behalf.
 */
export type VariableStrategyProps<P> =
  | { type: 'react-rerender'; props: P }
  | { type: 'callbacks'; props: () => P; callbacks: Callbacks<undefined> };

/**
 * Converts a VariablyStrategyProps, which is usually used as the type that's
 * passed in as a prop to a component, into a ValueWithCallbacks, which is
 * a simplified version of the 'callbacks' option, which changes without
 * triggering a react rerender.
 *
 * Example:
 *
 * ```tsx
 * const MyComponent = (
 *   { propsVariableStrategy }: {
 *     propsVariableStrategy: VariableStrategyProps<{ textContent: string }>;
 *   }
 * ): ReactElement => {
 *   const props = useVariableStrategyPropsAsValueWithCallbacks(propsVariableStrategy);
 *   const containerRef = useRef<HTMLDivElement>(null);
 *
 *   useEffect(() => {
 *     props.callbacks.add(render);
 *     render();
 *     return () => {
 *       if (containerRef.current === null) {
 *         return;
 *       }
 *       containerRef.current.textContent = props.get().textContent;
 *     }
 *   })
 *
 *   return <div ref={containerRef} />;
 * };
 *
 * // usage example, using react rerender strategy
 * <MyComponent propsVariableStrategy={{
 *   type: 'react-rerender',
 *   props: { textContent: 'hello' }
 * }} />
 *
 * // alternatively, using callbacks strategy
 * const componentProps = useWritableValueWithCallbacks({ textContent: 'hello' });
 * <MyComponent propsVariableStrategy={{
 *   type: 'callbacks',
 *   props: componentProps.get,
 *   callbacks: componentProps.callbacks
 * }} />
 * ```
 *
 * @param props The variable strategy props to adapt
 * @returns The adapted props using the least common denominator, ValueWithCallbacks
 */
export const useVariableStrategyPropsAsValueWithCallbacks = <P>(
  props: VariableStrategyProps<P>
): ValueWithCallbacks<P> => {
  const result = useWritableValueWithCallbacks<P>(() =>
    props.type === 'react-rerender' ? props.props : props.props()
  );

  useEffect(() => {
    if (props.type === 'react-rerender') {
      result.set(props.props);
      result.callbacks.call(undefined);
      return;
    }

    const propsGetter = props.props;
    const propsCallbacks = props.callbacks;
    propsCallbacks.add(handleChange);
    handleChange();
    return () => {
      propsCallbacks.remove(handleChange);
    };

    function handleChange() {
      const newV = propsGetter();
      if (newV !== result.get()) {
        result.set(newV);
        result.callbacks.call(undefined);
      }
    }
  }, [props, result]);

  return result;
};
