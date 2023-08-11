import { PropsWithChildren, ReactElement, useEffect, useRef } from 'react';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../anim/VariableStrategyProps';
import { useWritableValueWithCallbacks } from '../lib/Callbacks';
import { useAnimatedValueWithCallbacks } from '../anim/useAnimatedValueWithCallbacks';
import { BezierAnimator } from '../anim/AnimationLoop';
import { ease } from '../lib/Bezier';
import { useValueWithCallbacksEffect } from '../hooks/useValueWithCallbacksEffect';
import { setVWC } from '../lib/setVWC';

type SmoothExpandableProps = {
  /**
   * True if the component should be expanded, false if it should be collapsed.
   */
  expanded: VariableStrategyProps<boolean>;
};

const renderHeight = (div: HTMLDivElement, heightPercent: number, defaultHeight: number) => {
  if (heightPercent <= 0 || defaultHeight === 0) {
    div.style.removeProperty('overflow-y');
    div.style.removeProperty('height');
    div.style.display = 'none';
    return;
  }

  if (heightPercent >= 100) {
    div.style.removeProperty('overflow-y');
    div.style.removeProperty('height');
    div.style.removeProperty('display');
    return;
  }

  div.style.overflowY = 'hidden';
  div.style.height = `${defaultHeight * (heightPercent / 100.0)}px`;
  div.style.removeProperty('display');
};

/**
 * A smooth vertically expandable component. Works best when the children
 * have no outer vertical margin, but they can have padding. The children
 * should render to the exact correct height immediately; the most common
 * reason this would fail (beyond the obvious) would be if you are using
 * custom fonts but not waiting for them to load before rendering this
 * component.
 *
 * If you want the smooth expandable with a basic expand/collapse button,
 * use the `TogglableSmoothExpandable` component.
 */
export const SmoothExpandable = ({
  expanded: expandedVariableStrategy,
  children,
}: PropsWithChildren<SmoothExpandableProps>): ReactElement => {
  const expanded = useVariableStrategyPropsAsValueWithCallbacks(expandedVariableStrategy);
  const defaultHeight = useWritableValueWithCallbacks(() => 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedHeightPerc = useWritableValueWithCallbacks(() => 100);

  const targetState = useAnimatedValueWithCallbacks<{ heightPercent: number }>(
    { heightPercent: expanded.get() ? 100 : 0 },
    () => [
      new BezierAnimator(
        ease,
        350,
        (s) => s.heightPercent,
        (s, v) => (s.heightPercent = v)
      ),
    ],
    (state) => {
      if (containerRef.current === null) {
        return;
      }
      const ele = containerRef.current;
      renderHeight(ele, state.heightPercent, defaultHeight.get());
      setVWC(renderedHeightPerc, state.heightPercent);
    }
  );

  useEffect(() => {
    if (containerRef.current === null) {
      return;
    }
    let active = true;
    let updatingHeight = false;
    const ele = containerRef.current;
    updateHeight();

    let resizeObserver: ResizeObserver | null = null;
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        const perc = renderedHeightPerc.get();
        if (perc >= 0 && perc < 100) {
          // this is just us animating
          return;
        }
        updateHeight();
      });
      resizeObserver.observe(ele);
    }
    return () => {
      if (active) {
        active = false;
        if (resizeObserver !== null) {
          resizeObserver.disconnect();
        }
      }
    };

    function updateHeight() {
      if (!active || updatingHeight) {
        return;
      }
      updatingHeight = true;
      try {
        if (renderedHeightPerc.get() === 100) {
          const height = ele.getBoundingClientRect().height;
          defaultHeight.set(height);
        } else {
          ele.removeAttribute('style');
          const height = ele.getBoundingClientRect().height;
          defaultHeight.set(height);
          renderHeight(ele, renderedHeightPerc.get(), height);
        }
      } finally {
        updatingHeight = false;
      }
    }
  }, [children, defaultHeight, targetState, renderedHeightPerc]);

  useValueWithCallbacksEffect(expanded, (e) => {
    setVWC(targetState, { heightPercent: e ? 100 : 0 });
    return undefined;
  });

  return <div ref={containerRef}>{children}</div>;
};
