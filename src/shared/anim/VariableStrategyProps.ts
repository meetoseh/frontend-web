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
