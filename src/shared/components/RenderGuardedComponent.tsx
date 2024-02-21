import { ReactElement } from 'react';
import { ValueWithCallbacks } from '../lib/Callbacks';
import { useUnwrappedValueWithCallbacks } from '../hooks/useUnwrappedValueWithCallbacks';

type RenderGuardedComponentProps<T> = {
  props: ValueWithCallbacks<T>;
  component: (current: T) => ReactElement;
  equalityFn?: (a: T, b: T) => boolean;
  /**
   * If true we apply this change via setState immediately, rather than on
   * the next frame. This is NOT how react native works, and should only be
   * used if necessary as it will increase debugging complexity.
   *
   * Generally, this only needs to be done for managed input fields.
   */
  applyInstantly?: boolean;
};

/**
 * This uses the component function and the value of the props to
 * render the component.
 *
 * As the name implies, this guards renders: changes to the props will
 * only cause the component to rerender, not the parent (the one rendering
 * this component) to rerender, or the one which created the props
 * to rerender.
 *
 * Since it's often very convenient to lift props creation (e.g., loading
 * images very high up in the state chain so we know whether or not a
 * full-page spinner should be shown), but rerendering high up in the
 * chain is very expensive, this component provides a high-performance
 * way to accomplish both goals: lifted state, restricted rerenders.
 */
export function RenderGuardedComponent<T>({
  props,
  component,
  equalityFn,
  applyInstantly,
}: RenderGuardedComponentProps<T>): ReactElement {
  const realProps = useUnwrappedValueWithCallbacks(props, equalityFn, applyInstantly);

  return component(realProps);
}
