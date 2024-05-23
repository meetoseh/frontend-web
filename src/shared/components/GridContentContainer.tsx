import { CSSProperties, PropsWithChildren, ReactElement, useEffect } from 'react';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import styles from './GridContentContainer.module.css';
import { ContentContainer } from './ContentContainer';
import { setVWC } from '../lib/setVWC';
import { convertLogicalWidthToPhysicalWidth } from '../images/DisplayRatioHelper';
import { useMappedValueWithCallbacks } from '../hooks/useMappedValueWithCallbacks';
import { useStyleVWC } from '../hooks/useStyleVWC';
import { createValueWithCallbacksEffect } from '../hooks/createValueWithCallbacksEffect';

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
  minHeightVWC,
  left,
  opacity,
  justifyContent,
  children,
}: PropsWithChildren<
  {
    contentWidthVWC: ValueWithCallbacks<number>;
    /** Left offset for slide transitions */
    left?: ValueWithCallbacks<number>;
    /** Opacity for fade transitions */
    opacity?: ValueWithCallbacks<number>;
  } & (
    | {
        /** Overrides the centering justify-content option */
        justifyContent?: 'flex-start' | 'flex-end';
        /**
         * The minimum height of the content. If justify-content space-between or space-around is set
         * then this needs to be set to do anything useful, otherwise it does nothing
         */
        minHeightVWC?: undefined;
      }
    | {
        justifyContent: 'space-between' | 'space-around';
        minHeightVWC: ValueWithCallbacks<number>;
      }
  )
>): ReactElement => {
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
  }, [left, opacity, containerTransitionState]);

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

  const overflowerStyleVWC = useWritableValueWithCallbacks<CSSProperties>(() => ({
    minHeight: undefined,
  }));
  useEffect(() => {
    if (minHeightVWC === undefined) {
      setVWC(overflowerStyleVWC, { minHeight: undefined });
      return;
    }
    return createValueWithCallbacksEffect(minHeightVWC, (minHeight) => {
      setVWC(overflowerStyleVWC, { minHeight: `${minHeight}px` });
      return undefined;
    });
  });
  const overflowerRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  useStyleVWC(overflowerRef, overflowerStyleVWC);

  return (
    <div
      className={styles.container}
      ref={(r) => setVWC(containerRef, r)}
      style={containerStyleVWC.get()}>
      <div className={styles.underflower}>
        <div
          className={styles.overflower}
          style={overflowerStyleVWC.get()}
          ref={(r) => setVWC(overflowerRef, r)}>
          <ContentContainer contentWidthVWC={contentWidthVWC} justifyContent={justifyContent}>
            {children}
          </ContentContainer>
        </div>
      </div>
    </div>
  );
};
