import { PropsWithChildren, ReactElement, useCallback, useEffect, useRef } from 'react';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../anim/VariableStrategyProps';
import styles from './FlowChart.module.css';
import { Callbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import { setVWC } from '../lib/setVWC';
import { RenderGuardedComponent } from './RenderGuardedComponent';
import { useAnimatedValueWithCallbacks } from '../anim/useAnimatedValueWithCallbacks';
import { BezierAnimator, BezierColorAnimator, TrivialAnimator } from '../anim/AnimationLoop';
import { ease } from '../lib/Bezier';
import { useValuesWithCallbacksEffect } from '../hooks/useValuesWithCallbacksEffect';

export type FlowChartProps = {
  /**
   * The horizontal space between two elements displayed on the same row.
   */
  columnGap: VariableStrategyProps<number>;
  /**
   * The vertical space between rows
   */
  rowGap: VariableStrategyProps<number>;
  /**
   * The thickness of the arrow line in logical pixels.
   */
  lineThickness: VariableStrategyProps<number>;
  /**
   * The color for the lines, as [0-1, 0-1, 0-1, 0-1] for
   * red, green, blue, and alpha.
   */
  color: VariableStrategyProps<[number, number, number, number]>;
  /**
   * The distance from the block to the tail or head of the arrow
   * in logical pixels.
   */
  arrowBlockGapPx: VariableStrategyProps<{
    /**
     * The gap between a child and the start of the arrow.
     */
    tail: number;
    /**
     * The gap between a child and the end of the arrow.
     */
    head: number;
  }>;
  /**
   * The size of the arrow head lines in logical pixels.
   */
  arrowHeadLengthPx: VariableStrategyProps<number>;

  /**
   * The angle for the arrow head in degrees.
   */
  arrowHeadAngleDeg: VariableStrategyProps<number>;
};

const areNumbersClose = (a: number, b: number) => {
  return a === b || (Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) < 1e-4;
};
const containerWidthComparer = areNumbersClose;
const childrenSizesComparer = (
  a: { width: number; height: number }[],
  b: { width: number; height: number }[]
) => {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  return a.every(
    (aItem, i) =>
      areNumbersClose(aItem.width, b[i].width) && areNumbersClose(aItem.height, b[i].height)
  );
};

type FlowChartAnimationTarget = {
  columnGap: number;
  rowGap: number;
  lineThickness: number;
  color: [number, number, number, number];
  arrowBlockGapPx: {
    tail: number;
    head: number;
  };
  arrowHeadLengthPx: number;
  arrowHeadAngleDeg: number;
  containerWidth: number;
  childrenSizes: { width: number; height: number }[];
};

type Box = { x: number; y: number; width: number; height: number };
/**
 * Renders a flow chart, which is a full width (width 100%) container that
 * displays its children like a row, wrapping, gapped flex container. Unlike
 * a regular flex flow, however, this connects consecutive items with an
 * arrow. This uses both a horizontal arrow for connecting two items in
 * the same row, and a segmented arrow for connecting the end of one row
 * to the start of the next row.
 *
 * This assumes the simplest type of flow chart: a single path from start
 * to finish.
 *
 * This component will only connect arrows between distinct children, so
 * e.g
 *
 * ```tsx
 * <FlowChart>
 *   <div>...</div>
 *   <div>...</div>
 *   <div>...</div>
 * </FlowChart>
 * ```
 *
 * which will lead to two arrows, vs this will lead to no arrows
 *
 * ```tsx
 * <FlowChart>
 *   <>
 *     <div>...</div>
 *     <div>...</div>
 *     <div>...</div>
 *   </>
 * </FlowChart>
 * ```
 *
 * Also, fragments of text will result in undefined behavior, so
 * definitely don't do this:
 *
 * ```tsx
 * <FlowChart>Text here is not allowed!</FlowChart>
 * ```
 */
export const FlowChart = ({
  columnGap: columnGapVariableStrategy,
  rowGap: rowGapVariableStrategy,
  color: colorVariableStrategy,
  lineThickness: lineThicknessVariableStrategy,
  arrowBlockGapPx: arrowBlockGapPxVariableStrategy,
  arrowHeadLengthPx: arrowHeadLengthPxVariableStrategy,
  arrowHeadAngleDeg: arrowHeadAngleDegVariableStrategy,
  children,
}: PropsWithChildren<FlowChartProps>): ReactElement => {
  const columnGapVWC = useVariableStrategyPropsAsValueWithCallbacks(columnGapVariableStrategy);
  const rowGapVWC = useVariableStrategyPropsAsValueWithCallbacks(rowGapVariableStrategy);
  const colorVWC = useVariableStrategyPropsAsValueWithCallbacks(colorVariableStrategy);
  const lineThicknessVWC = useVariableStrategyPropsAsValueWithCallbacks(
    lineThicknessVariableStrategy
  );
  const arrowBlockGapPxVWC = useVariableStrategyPropsAsValueWithCallbacks(
    arrowBlockGapPxVariableStrategy
  );
  const arrowHeadLengthPxVWC = useVariableStrategyPropsAsValueWithCallbacks(
    arrowHeadLengthPxVariableStrategy
  );
  const arrowHeadAngleDegVWC = useVariableStrategyPropsAsValueWithCallbacks(
    arrowHeadAngleDegVariableStrategy
  );
  const childrenSizesVWC = useWritableValueWithCallbacks<{ width: number; height: number }[]>(
    () => []
  );
  const containerWidthVWC = useWritableValueWithCallbacks<number>(() => 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const childrenContainerRef = useRef<HTMLDivElement>(null);
  const arrowsVWC = useWritableValueWithCallbacks<ReactElement[]>(() => []);

  const render = useCallback(
    (target: FlowChartAnimationTarget) => {
      if (containerRef.current === null || childrenContainerRef.current === null) {
        return;
      }

      const container = containerRef.current;
      const childrenContainer = childrenContainerRef.current;
      const newArrows: ReactElement[] = [];

      let y = 0;
      let currentRow: { idx: number; ele: HTMLDivElement; width: number; height: number }[] = [];

      /**
       * completes the current row: increases y and clears currentRow
       * @returns the {x, y, width, height} of the items in the row
       */
      const positionAndConnectHorizontallyCurrentRow = (): Box[] => {
        if (currentRow.length === 0) {
          return [];
        }

        const rowHeight = currentRow.reduce((acc, cur) => Math.max(acc, cur.height), 0);
        let rowWidth = 0;
        for (let i = 0; i < currentRow.length; i++) {
          if (i !== 0) {
            rowWidth += target.columnGap;
          }
          rowWidth += currentRow[i].width;
        }

        let x = (target.containerWidth - rowWidth) / 2;
        const result: Box[] = [];
        for (let i = 0; i < currentRow.length; i++) {
          if (i !== 0) {
            newArrows.push(
              <div
                key={newArrows.length}
                className={styles.arrow}
                style={{
                  left: `${x + target.arrowBlockGapPx.tail}px`,
                  top: `${y}px`,
                  width: `${
                    target.columnGap - target.arrowBlockGapPx.tail - target.arrowBlockGapPx.head
                  }px`,
                  height: `${rowHeight}px`,
                }}>
                <SimpleHorizontalArrow
                  width={
                    target.columnGap - target.arrowBlockGapPx.tail - target.arrowBlockGapPx.head
                  }
                  color={target.color}
                  thickness={target.lineThickness}
                  headLength={target.arrowHeadLengthPx}
                  headAngle={target.arrowHeadAngleDeg}
                />
              </div>
            );
            x += target.columnGap;
          }

          const itemX = x;
          const itemY = y + (rowHeight - currentRow[i].height) / 2;
          currentRow[i].ele.style.left = `${itemX}px`;
          currentRow[i].ele.style.top = `${itemY}px`;
          result.push({
            x: itemX,
            y: itemY,
            width: currentRow[i].width,
            height: currentRow[i].height,
          });

          x += currentRow[i].width;
        }

        return result;
      };

      const connectRowsVertically = (a: Box[], b: Box[]) => {
        const startY = a[a.length - 1].y + a[a.length - 1].height + target.arrowBlockGapPx.tail;
        const endY = b[0].y - target.arrowBlockGapPx.head;

        const height = endY - startY;
        const topRowBottom = a.reduce((acc, cur) => Math.max(acc, cur.y + cur.height), 0);
        newArrows.push(
          <div
            key={newArrows.length}
            className={styles.arrow}
            style={{
              left: `0px`,
              top: `${startY}px`,
              width: `${target.containerWidth}px`,
              height: `${height}px`,
            }}>
            <VerticalDisjointArrow
              startX={a[a.length - 1].x + a[a.length - 1].width / 2}
              endX={b[0].x + b[0].width / 2}
              width={target.containerWidth}
              height={height}
              horizontalLineY={topRowBottom - startY + target.rowGap / 2}
              color={target.color}
              thickness={target.lineThickness}
              headLength={target.arrowHeadLengthPx}
              headAngle={target.arrowHeadAngleDeg}
            />
          </div>
        );
      };

      let lastRow: { idx: number; ele: HTMLDivElement; bb: Box }[] | null = null;
      let spaceRemainingInRow = target.containerWidth;

      const finishRowUsingSpecialCases = (): boolean => {
        if (
          lastRow !== null &&
          currentRow.length === 1 &&
          currentRow[0].width <= lastRow[lastRow.length - 1].bb.width
        ) {
          // See if we can squish this item into the previous row in the suprisingly
          // common case where the previous row has a tall item but the last item isn't
          // tall. It'd be better to solve the more advanced problem of vertically
          // stacking more generally, but this is a good enough solution for now.

          const tallestItemInLastRow = lastRow.reduce(
            (acc, cur) => Math.max(acc, cur.bb.height),
            0
          );
          const heightLastItemInLastRow = lastRow[lastRow.length - 1].bb.height;
          const heightCurrentItem = currentRow[0].height;
          const heightUsedIfSquished = heightLastItemInLastRow + target.rowGap + heightCurrentItem;
          if (heightUsedIfSquished <= tallestItemInLastRow) {
            const lastRowMinY = lastRow.reduce((acc, cur) => Math.min(acc, cur.bb.y), Infinity);
            const lastRowCenterY = lastRowMinY + tallestItemInLastRow / 2;
            const lastRowLastColCenterX =
              lastRow[lastRow.length - 1].bb.x + lastRow[lastRow.length - 1].bb.width / 2;

            const lastRowLastItemNewY = lastRowCenterY - heightUsedIfSquished / 2;
            const lastRowLastItemEndY = lastRowLastItemNewY + heightLastItemInLastRow;
            const verticalArrowY = lastRowLastItemEndY + target.arrowBlockGapPx.tail;
            const verticalArrowEndY =
              lastRowLastItemEndY + target.rowGap - target.arrowBlockGapPx.head;
            const newItemY = lastRowLastItemEndY + target.rowGap;
            const newItemX = lastRowLastColCenterX - currentRow[0].width / 2;

            lastRow[lastRow.length - 1].ele.style.top = `${lastRowLastItemNewY}px`;

            // We're going to redo the connection from the second-to-last item in the
            // previous row to the last item in the previous row
            const lastRowSecondFromLastItem = lastRow[lastRow.length - 2];
            const lastRowSecondFromLastItemEndX =
              lastRowSecondFromLastItem.bb.x + lastRowSecondFromLastItem.bb.width;
            const lastRowLastItemNewCenterY = lastRowLastItemNewY + heightLastItemInLastRow / 2;
            newArrows.pop();
            newArrows.push(
              <div
                key={newArrows.length}
                className={styles.arrow}
                style={{
                  left: `${lastRowSecondFromLastItemEndX + target.arrowBlockGapPx.tail}px`,
                  top: `${lastRowSecondFromLastItem.bb.y}px`,
                  width: `${
                    target.columnGap - target.arrowBlockGapPx.tail - target.arrowBlockGapPx.head
                  }px`,
                  height: `${lastRowSecondFromLastItem.bb.height}px`,
                }}>
                <HorizontalDisjointArrow
                  startY={lastRowSecondFromLastItem.bb.height / 2}
                  endY={lastRowLastItemNewCenterY - lastRowSecondFromLastItem.bb.y}
                  width={
                    target.columnGap - target.arrowBlockGapPx.tail - target.arrowBlockGapPx.head
                  }
                  height={lastRowSecondFromLastItem.bb.height}
                  verticalLineX={
                    (target.columnGap - target.arrowBlockGapPx.tail - target.arrowBlockGapPx.head) /
                    2
                  }
                  color={target.color}
                  thickness={target.lineThickness}
                  headLength={target.arrowHeadLengthPx}
                  headAngle={target.arrowHeadAngleDeg}
                />
              </div>
            );

            // and now we connect the new item to the previous row
            lastRow.push({
              idx: currentRow[0].idx,
              ele: currentRow[0].ele,
              bb: {
                x: newItemX,
                y: newItemY,
                width: currentRow[0].width,
                height: currentRow[0].height,
              },
            });
            const newArrowSize = calculateSimpleVerticalArrowSvgSize({
              height: verticalArrowEndY - verticalArrowY,
              thickness: target.lineThickness,
              headLength: target.arrowHeadLengthPx,
              headAngle: target.arrowHeadAngleDeg,
            });
            newArrows.push(
              <div
                key={newArrows.length}
                className={styles.arrow}
                style={{
                  left: `${lastRowLastColCenterX - newArrowSize.width / 2}px`,
                  top: `${verticalArrowY}px`,
                  width: `${newArrowSize.width}px`,
                  height: `${newArrowSize.height}px`,
                }}>
                <SimpleVerticalArrow
                  height={verticalArrowEndY - verticalArrowY}
                  thickness={target.lineThickness}
                  headLength={target.arrowHeadLengthPx}
                  headAngle={target.arrowHeadAngleDeg}
                  color={target.color}
                />
              </div>
            );

            currentRow[0].ele.style.left = `${newItemX}px`;
            currentRow[0].ele.style.top = `${newItemY}px`;

            currentRow = [];
            return true;
          }
        }
        return false;
      };

      const finishRow = () => {
        if (finishRowUsingSpecialCases()) {
          return;
        }

        const row = positionAndConnectHorizontallyCurrentRow();
        if (lastRow !== null) {
          connectRowsVertically(
            lastRow.map((i) => i.bb),
            row
          );
        }
        lastRow = currentRow.map((i, idx) => ({ idx: i.idx, ele: i.ele, bb: row[idx] }));
        y = row.reduce((acc, cur) => Math.max(acc, cur.y + cur.height), 0) + target.rowGap;
        currentRow = [];
        spaceRemainingInRow = target.containerWidth;
      };

      for (let i = 0; i < target.childrenSizes.length; i++) {
        if (
          currentRow.length !== 0 &&
          spaceRemainingInRow - target.columnGap < target.childrenSizes[i].width
        ) {
          finishRow();
        }

        const childForPositioning = childrenContainer.children[i] as HTMLDivElement;
        const childSize = target.childrenSizes[i];
        currentRow.push({
          idx: i,
          ele: childForPositioning,
          width: childSize.width,
          height: childSize.height,
        });
        spaceRemainingInRow -= childSize.width + (currentRow.length === 1 ? 0 : target.columnGap);
      }

      finishRow();
      setVWC(arrowsVWC, newArrows);
      container.style.height = `${y}px`;
    },
    [arrowsVWC]
  );

  const target = useAnimatedValueWithCallbacks<FlowChartAnimationTarget>(
    {
      columnGap: columnGapVWC.get(),
      rowGap: rowGapVWC.get(),
      lineThickness: lineThicknessVWC.get(),
      arrowBlockGapPx: { ...arrowBlockGapPxVWC.get() },
      color: [...colorVWC.get()],
      arrowHeadLengthPx: arrowHeadLengthPxVWC.get(),
      arrowHeadAngleDeg: arrowHeadAngleDegVWC.get(),
      containerWidth: containerWidthVWC.get(),
      childrenSizes: childrenSizesVWC.get().map((i) => ({ width: i.width, height: i.height })),
    },
    () => [
      new BezierAnimator(
        ease,
        350,
        (t) => t.columnGap,
        (t, v) => (t.columnGap = v)
      ),
      new BezierAnimator(
        ease,
        350,
        (t) => t.rowGap,
        (t, v) => (t.rowGap = v)
      ),
      new BezierAnimator(
        ease,
        350,
        (t) => t.lineThickness,
        (t, v) => (t.lineThickness = v)
      ),
      new BezierAnimator(
        ease,
        350,
        (t) => t.arrowBlockGapPx.tail,
        (t, v) => (t.arrowBlockGapPx.tail = v)
      ),
      new BezierAnimator(
        ease,
        350,
        (t) => t.arrowBlockGapPx.head,
        (t, v) => (t.arrowBlockGapPx.head = v)
      ),
      new BezierColorAnimator(
        ease,
        350,
        (t) => t.color,
        (t, v) => (t.color = v)
      ),
      new BezierAnimator(
        ease,
        350,
        (t) => t.arrowHeadLengthPx,
        (t, v) => (t.arrowHeadLengthPx = v)
      ),
      new BezierAnimator(
        ease,
        350,
        (t) => t.arrowHeadAngleDeg,
        (t, v) => (t.arrowHeadAngleDeg = v)
      ),
      new TrivialAnimator('containerWidth', { equalityFn: areNumbersClose }),
      new TrivialAnimator('childrenSizes', {
        cloneFn: (v) => v.map((i) => ({ width: i.width, height: i.height })),
        equalityFn: childrenSizesComparer,
      }),
    ],
    render
  );

  useEffect(() => {
    if (containerRef.current === null) {
      return;
    }

    let active = true;
    const ele = containerRef.current;
    const cancelers = new Callbacks<undefined>();
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver((entries) => {
        if (!active || entries.length < 1) {
          return;
        }
        setVWC(containerWidthVWC, entries[0].contentRect.width, containerWidthComparer);
      });
      resizeObserver.observe(ele);
      cancelers.add(() => resizeObserver.disconnect());
    } else {
      const resizeListener = () => {
        if (!active) {
          return;
        }
        setVWC(containerWidthVWC, ele.getBoundingClientRect().width, containerWidthComparer);
      };
      window.addEventListener('resize', resizeListener);
      cancelers.add(() => window.removeEventListener('resize', resizeListener));
    }
    return () => {
      if (active) {
        active = false;
        cancelers.call(undefined);
      }
    };
  }, [containerWidthVWC]);

  useEffect(() => {
    if (childrenContainerRef.current === null) {
      return;
    }

    let numChildren =
      children === null || children === undefined
        ? 0
        : Array.isArray(children)
        ? children.length
        : 1;
    if (childrenContainerRef.current.children.length !== numChildren) {
      return;
    }

    let active = true;
    const ele = childrenContainerRef.current;
    const cancelers = new Callbacks<undefined>();
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver((entries) => {
        if (!active) {
          return;
        }
        const updatedSizes = [...childrenSizesVWC.get()];
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          const target = entry.target as HTMLElement;
          if (target.dataset.index === undefined) {
            continue;
          }
          const idx = parseInt(target.dataset.index);
          updatedSizes[idx] = { width, height };
        }
        setVWC(childrenSizesVWC, updatedSizes, childrenSizesComparer);
      });
      for (let i = 0; i < ele.children.length; i++) {
        const child = ele.children[i] as HTMLElement;
        child.dataset.index = i.toString();
        resizeObserver.observe(child);
      }
      cancelers.add(() => {
        resizeObserver.disconnect();
      });
    }
    updateSizes();
    return () => {
      if (active) {
        active = false;
        cancelers.call(undefined);
      }
    };

    function updateSizes() {
      const newSizes: { width: number; height: number }[] = [];
      for (let i = 0; i < ele.children.length; i++) {
        const child = ele.children[i] as HTMLElement;
        const { width, height } = child.getBoundingClientRect();
        newSizes.push({ width, height });
      }
      setVWC(childrenSizesVWC, newSizes, childrenSizesComparer);
    }
  }, [childrenSizesVWC, children]);

  useValuesWithCallbacksEffect(
    [
      columnGapVWC,
      rowGapVWC,
      lineThicknessVWC,
      colorVWC,
      arrowBlockGapPxVWC,
      arrowHeadLengthPxVWC,
      arrowHeadAngleDegVWC,
      containerWidthVWC,
      childrenSizesVWC,
    ],
    () => {
      setVWC(target, {
        columnGap: columnGapVWC.get(),
        rowGap: rowGapVWC.get(),
        lineThickness: lineThicknessVWC.get(),
        color: colorVWC.get(),
        arrowBlockGapPx: arrowBlockGapPxVWC.get(),
        arrowHeadLengthPx: arrowHeadLengthPxVWC.get(),
        arrowHeadAngleDeg: arrowHeadAngleDegVWC.get(),
        containerWidth: containerWidthVWC.get(),
        childrenSizes: childrenSizesVWC.get(),
      });
      return undefined;
    }
  );

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.childrenContainer} ref={childrenContainerRef}>
        {!Array.isArray(children) ? (
          <div className={styles.child}>{children}</div>
        ) : (
          children.map((i, idx) => (
            <div key={idx} className={styles.child}>
              {i}
            </div>
          ))
        )}
      </div>
      <div className={styles.arrowsContainer}>
        <RenderGuardedComponent props={arrowsVWC} component={(arrows) => <>{arrows}</>} />
      </div>
    </div>
  );
};

type SimpleHorizontalArrowProps = {
  width: number;
  color: [number, number, number, number];
  thickness: number;
  headLength: number;
  headAngle: number;
};

const calculateSimpleHorizontalArrowSvgSize = ({
  width,
  thickness,
  headLength,
  headAngle,
}: Omit<SimpleHorizontalArrowProps, 'color'>) => {
  return {
    width: width,
    height: (Math.sin((Math.PI * headAngle) / 180) * headLength + thickness / 2) * 2,
  };
};

const colorFloatToByte = (color: number): number => {
  return Math.max(0, Math.min(255, Math.round(color * 255)));
};

const colorToCSS = (color: [number, number, number, number]) => {
  return `rgba(${colorFloatToByte(color[0])}, ${colorFloatToByte(color[1])}, ${colorFloatToByte(
    color[2]
  )}, ${color[3]})`;
};

const makeSVGNumber = (v: number): string => {
  return `${Number(v.toFixed(3))}`;
};

const makeLinePath = (data: number[]): string => {
  if (data.length === 0) {
    return '';
  }

  if (data.length % 2 !== 0) {
    throw new Error('data must have an even number of elements');
  }

  const numPoints = data.length / 2;

  const parts = [`M${makeSVGNumber(data[0])} ${makeSVGNumber(data[1])}`];
  for (let i = 1; i < numPoints; i++) {
    parts.push(`L${makeSVGNumber(data[i * 2])} ${makeSVGNumber(data[i * 2 + 1])}`);
  }
  return parts.join('');
};

const makeSimplePath = ({
  x1,
  y1,
  x2,
  y2,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}): string => {
  return makeLinePath([x1, y1, x2, y2]);
};

const SimpleHorizontalArrow = ({
  width,
  color,
  thickness,
  headLength,
  headAngle,
}: SimpleHorizontalArrowProps): ReactElement => {
  const headEndOffset = {
    x: Math.cos((Math.PI * headAngle) / 180) * headLength,
    y: Math.sin((Math.PI * headAngle) / 180) * headLength,
  };
  const size = calculateSimpleHorizontalArrowSvgSize({ width, thickness, headLength, headAngle });
  const lineCenterY = size.height / 2;

  return (
    <svg
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      xmlns="http://www.w3.org/2000/svg">
      <path
        d={
          makeSimplePath({
            x1: thickness / 2,
            y1: lineCenterY,
            x2: size.width - thickness / 2,
            y2: lineCenterY,
          }) +
          // Can join these two line paths to get a filled arrow head
          makeLinePath([
            size.width - thickness / 2 - headEndOffset.x,
            lineCenterY - headEndOffset.y,
            size.width - thickness / 2,
            lineCenterY,
          ]) +
          makeLinePath([
            size.width - thickness / 2,
            lineCenterY,
            size.width - thickness / 2 - headEndOffset.x,
            lineCenterY + headEndOffset.y,
          ])
        }
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeMiterlimit={10}
        stroke={colorToCSS(color)}
      />
    </svg>
  );
};

type SimpleVerticalArrowProps = {
  height: number;
  color: [number, number, number, number];
  thickness: number;
  headLength: number;
  headAngle: number;
};

const calculateSimpleVerticalArrowSvgSize = ({
  height,
  thickness,
  headLength,
  headAngle,
}: Omit<SimpleVerticalArrowProps, 'color'>) => {
  return {
    width: (Math.sin((Math.PI * headAngle) / 180) * headLength + thickness / 2) * 2,
    height,
  };
};

const SimpleVerticalArrow = ({
  height,
  color,
  thickness,
  headLength,
  headAngle,
}: SimpleVerticalArrowProps): ReactElement => {
  const headEndOffset = {
    x: Math.sin((Math.PI * headAngle) / 180) * headLength,
    y: Math.cos((Math.PI * headAngle) / 180) * headLength,
  };
  const size = calculateSimpleVerticalArrowSvgSize({ height, thickness, headLength, headAngle });
  const lineCenterX = size.width / 2;

  return (
    <svg
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      xmlns="http://www.w3.org/2000/svg">
      <path
        d={
          makeSimplePath({
            x1: lineCenterX,
            y1: thickness / 2,
            x2: lineCenterX,
            y2: size.height - thickness / 2,
          }) +
          // Can join these two line paths to get a filled arrow head
          makeLinePath([
            lineCenterX - headEndOffset.x,
            size.height - thickness / 2 - headEndOffset.y,
            lineCenterX,
            size.height - thickness / 2,
          ]) +
          makeLinePath([
            lineCenterX,
            size.height - thickness / 2,
            lineCenterX + headEndOffset.x,
            size.height - thickness / 2 - headEndOffset.y,
          ])
        }
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeMiterlimit={10}
        stroke={colorToCSS(color)}
      />
    </svg>
  );
};

type VerticalDisjointArrowProps = {
  startX: number;
  endX: number;
  /**
   * In theory width should be calculated, but it's more
   * convenient for the caller in this case to pass a bigger
   * width than is strictly necessary for the svg
   */
  width: number;
  height: number;
  horizontalLineY: number;
  color: [number, number, number, number];
  thickness: number;
  headLength: number;
  headAngle: number;
};

const VerticalDisjointArrow = ({
  startX,
  endX,
  width,
  height,
  horizontalLineY,
  color,
  thickness,
  headLength,
  headAngle,
}: VerticalDisjointArrowProps): ReactElement => {
  const arrowEndOffset = {
    x: headLength * Math.sin((Math.PI * headAngle) / 180),
    y: headLength * Math.cos((Math.PI * headAngle) / 180),
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg">
      <path
        d={
          makeSimplePath({
            x1: startX,
            y1: thickness / 2,
            x2: startX,
            y2: horizontalLineY,
          }) +
          makeSimplePath({
            x1: startX,
            y1: horizontalLineY,
            x2: endX,
            y2: horizontalLineY,
          }) +
          makeSimplePath({
            x1: endX,
            y1: horizontalLineY,
            x2: endX,
            y2: height - thickness / 2,
          }) +
          makeSimplePath({
            x1: endX - arrowEndOffset.x,
            y1: height - thickness / 2 - arrowEndOffset.y,
            x2: endX,
            y2: height - thickness / 2,
          }) +
          makeSimplePath({
            x1: endX + arrowEndOffset.x,
            y1: height - thickness / 2 - arrowEndOffset.y,
            x2: endX,
            y2: height - thickness / 2,
          })
        }
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeMiterlimit={10}
        stroke={colorToCSS(color)}
      />
    </svg>
  );
};

type HorizontalDisjointArrowProps = {
  startY: number;
  endY: number;
  width: number;
  /* in theory, calculated. in practice, may exceed the real height */
  height: number;
  verticalLineX: number;
  color: [number, number, number, number];
  thickness: number;
  headLength: number;
  headAngle: number;
};

const HorizontalDisjointArrow = ({
  startY,
  endY,
  width,
  height,
  verticalLineX,
  color,
  thickness,
  headLength,
  headAngle,
}: HorizontalDisjointArrowProps): ReactElement => {
  const headEndOffset = {
    x: Math.cos((Math.PI * headAngle) / 180) * headLength,
    y: Math.sin((Math.PI * headAngle) / 180) * headLength,
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg">
      <path
        d={
          makeSimplePath({
            x1: thickness / 2,
            y1: startY,
            x2: verticalLineX,
            y2: startY,
          }) +
          makeSimplePath({
            x1: verticalLineX,
            y1: startY,
            x2: verticalLineX,
            y2: endY,
          }) +
          makeSimplePath({
            x1: verticalLineX,
            y1: endY,
            x2: width - thickness / 2,
            y2: endY,
          }) +
          makeSimplePath({
            x1: width - thickness / 2 - headEndOffset.x,
            y1: endY - headEndOffset.y,
            x2: width - thickness / 2,
            y2: endY,
          }) +
          makeSimplePath({
            x1: width - thickness / 2 - headEndOffset.x,
            y1: endY + headEndOffset.y,
            x2: width - thickness / 2,
            y2: endY,
          })
        }
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeMiterlimit={10}
        stroke={colorToCSS(color)}
      />
    </svg>
  );
};
