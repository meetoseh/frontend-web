import { CSSProperties, PropsWithChildren, ReactElement, useEffect } from 'react';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import styles from './GridContentContainer.module.css';
import { ContentContainer } from './ContentContainer';
import { setVWC } from '../lib/setVWC';
import { convertLogicalWidthToPhysicalWidth } from '../images/DisplayRatioHelper';
import { useMappedValueWithCallbacks } from '../hooks/useMappedValueWithCallbacks';
import { useStyleVWC } from '../hooks/useStyleVWC';

/**
 * The standard grid container for content. This returns a div that
 * will span the entire grid of the parent (grid-area 1 / 1 / -1 / -1),
 * center/center a child `ContentContainer` with the given width containing
 * the given children.
 *
 * Typical vdom layout:
 * ```tsx
 * <GridFullscreenContainer>
 *   <GridContentContainer>
 *     <div>stuff</div>
 *   </GridContentContainer>
 * </GridFullscreenContainer>
 * ```
 */
export const GridContentContainer = ({
  contentWidthVWC,
  left,
  opacity,
  children,
}: PropsWithChildren<{
  contentWidthVWC: ValueWithCallbacks<number>;
  /** Left offset for slide transitions */
  left?: ValueWithCallbacks<number>;
  /** Opacity for fade transitions */
  opacity?: ValueWithCallbacks<number>;
}>): ReactElement => {
  const containerRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);

  const containerTransitionState = useWritableValueWithCallbacks<{ left: number; opacity: number }>(
    () => ({
      left: left?.get() ?? 0,
      opacity: opacity?.get() ?? 1,
    })
  );

  useEffect(() => {
    if (left === undefined && opacity === undefined) {
      setVWC(containerTransitionState, { left: 0, opacity: 1 });
      return;
    }

    left?.callbacks.add(update);
    opacity?.callbacks.add(update);
    update();
    return () => {
      left?.callbacks.remove(update);
      opacity?.callbacks.remove(update);
    };

    function update() {
      setVWC(
        containerTransitionState,
        {
          left: left?.get() ?? 0,
          opacity: opacity?.get() ?? 1,
        },
        (a, b) => a.left === b.left && a.opacity === b.opacity
      );
    }
  }, [left, opacity]);

  const containerStyleVWC = useMappedValueWithCallbacks(
    containerTransitionState,
    (transitionState): CSSProperties => {
      const leftValue = transitionState.left;
      const opacityValue = transitionState.opacity;

      const leftIsZero = convertLogicalWidthToPhysicalWidth(Math.abs(leftValue)) < 1;
      const opacityIsOne = opacityValue > 0.999;

      return {
        position: leftIsZero ? 'static' : 'relative',
        left: leftIsZero ? '0' : `${leftValue}px`,
        opacity: opacityIsOne ? 1 : opacityValue,
      };
    }
  );
  useStyleVWC(containerRef, containerStyleVWC);

  return (
    <div
      className={styles.container}
      ref={(r) => setVWC(containerRef, r)}
      style={containerStyleVWC.get()}>
      <ContentContainer contentWidthVWC={contentWidthVWC}>{children}</ContentContainer>
    </div>
  );
};
