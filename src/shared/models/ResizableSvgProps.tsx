import { SvgRequestedSize } from './SvgSize';

export type ResizableSvgPaddingFraction = {
  fraction: number;
  fixed?: undefined;
};

export type ResizableSvgPaddingFixed = {
  fraction?: undefined;
  fixed: number;
};

export type ResizableSvgPadding = ResizableSvgPaddingFraction | ResizableSvgPaddingFixed;

/**
 * Convenience function to compute the amount of padding indicated by a
 * ResizableSvgPadding object, when the fractional amount is relative to the given container
 */
export const computePadding = (container: number, config: ResizableSvgPadding): number => {
  if (config.fraction !== undefined) {
    return container * config.fraction;
  } else {
    return config.fixed;
  }
};

/** The props that a resizable svg usually accepts */
export type ResizableSvgProps = {
  /** How large the actual icon should be, in logical pixels */
  icon: SvgRequestedSize;

  /** How large the container should be, in logical pixels */
  container: { width: number; height: number };

  /**
   * Where to place any extra padding required to make the icon
   * fit in the container, where x and y are in [0, 1]. To put
   * all the padding at the top and left, use `{x: 1, y: 1}`. To put
   * all the padding at the bottom and right, use `{x: 0, y: 0}`.
   * To equally distribute the padding, use `{x: 0.5, y: 0.5}`.
   */
  startPadding: { x: ResizableSvgPadding; y: ResizableSvgPadding };

  /** The primary color for the icon */
  color: string;
};

export const areResizableSvgPropsEqual = (a: ResizableSvgProps, b: ResizableSvgProps): boolean =>
  a.icon.width === b.icon.width &&
  a.icon.height === b.icon.height &&
  a.container.width === b.container.width &&
  a.container.height === b.container.height &&
  a.startPadding.x.fixed === b.startPadding.x.fixed &&
  a.startPadding.x.fraction === b.startPadding.x.fraction &&
  a.startPadding.y.fixed === b.startPadding.y.fixed &&
  a.startPadding.y.fraction === b.startPadding.y.fraction &&
  a.color === b.color;
/**
 * The information from the svg we need to know to convert the provided props
 * to a more useful format
 */
export type ResizableSvgInfo = {
  /** The natural size of the svg; i.e., the viewbox to get no stretching, scaling, or padding */
  natural: { width: number; height: number };
} & ResizableSvgProps;

/** What a resizable svg usually converts its props to */
export type ResizableSvgComputedProps = {
  /** The width of the svg to produce in pixels */
  width: number;

  /** The height of the svg to produce in pixels */
  height: number;

  /** The viewbox for the svg with the necessary padding incorporated to avoid stretching */
  viewBox: string;

  /** The primary color */
  color: string;
};

/**
 * Converts the provided props and known information into a more useful format
 * for rendering the svg
 *
 * # Example 1: only padding
 *
 * Suppose we have a 100x100 rounded red square as follows:
 *
 * ```svg
 * <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
 *   <rect x="0" y="0" width="100" height="100" fill="red" rx="10" />
 * </svg>
 * ```
 *
 * And we want to render it at the same size but with 20px padding all around.
 * This would be a function call like:
 *
 * ```tsx
 * computeResizableSvgProps({
 *   natural: { width: 100, height: 100 },
 *   icon: { width: 100 },
 *   container: { width: 140, height: 140 },
 *   startPadding: { x: { fraction: 0.5 }, y: { fraction: 0.5 } },
 *   color: 'red'
 * })
 * ```
 *
 * and should be used to produce an svg like
 *
 * ```svg
 * <svg width="140" height="140" viewBox="-20 -20 140 140" fill="none">
 *   <rect x="0" y="0" width="100" height="100" fill="red" rx="10" />
 * </svg
 * ```
 *
 * i.e., the resizable svg computed props would be
 *
 * ```ts
 * { "width": 140, "height": 140, "viewBox": "-20 -20 140 140", "color": "red" }
 * ```
 *
 * # Example 2: only scaling
 *
 * Suppose we have a 100x100 rounded red square as above and we want to render
 * it at 50x50. This would be a function call like:
 *
 * ```tsx
 * computeResizableSvgProps({
 *  natural: { width: 100, height: 100 },
 *  icon: { width: 50 },
 *  container: { width: 50, height: 50 },
 *  startPadding: { x: { fraction: 0.5 }, y: { fraction: 0.5 } },
 *  color: 'red'
 * })
 * ```
 *
 * and should be used to produce an svg like
 *
 * ```svg
 * <svg width="50" height="50" viewBox="0 0 100 100" fill="none">
 *  <rect x="0" y="0" width="100" height="100" fill="red" rx="10" />
 * </svg>
 * ```
 *
 * # Example 3: pad only top left
 *
 * Suppose we have a 100x100 rounded red square as above and we want to render
 * it at 50x50 with 20px padding only on the top and left. This would be a function
 * call like:
 *
 * ```tsx
 * computeResizableSvgProps({
 *   natural: { width: 100, height: 100 },
 *   icon: { width: 50 },
 *   container: { width: 70, height: 70 },
 *   startPadding: { x: { fraction: 1 }, y: { fraction: 1 } },
 *   color: 'red'
 * })
 * ```
 *
 * and should be used to produce an svg like
 *
 * ```svg
 * <svg width="70" height="70" viewBox="-40 -40 100 100" fill="none">
 *   <rect x="0" y="0" width="100" height="100" fill="red" rx="10" />
 * </svg>
 * ```
 *
 * The reason the viewbox needs 40 padding despite only wanting 20 in the
 * output is because we want 40% additional padding (20 / 50), and in the
 * viewbox that corresponds to 40 (whereas 20 would only be 20% padding).
 */
export const computeResizableSvgProps = ({
  natural,
  icon,
  container,
  startPadding,
  color,
}: ResizableSvgInfo): ResizableSvgComputedProps => {
  const scale =
    icon.width === undefined ? icon.height / natural.height : icon.width / natural.width;

  const realWidth = natural.width * scale;
  const realTotalPaddingX = container.width - realWidth;
  const scaledTotalPaddingX = realTotalPaddingX / scale;
  const viewboxWidth = natural.width + scaledTotalPaddingX;
  const left = computePadding(scaledTotalPaddingX, startPadding.x);
  const viewboxLeft = -left;

  const realHeight = natural.height * scale;
  const realTotalPaddingY = container.height - realHeight;
  const scaledTotalPaddingY = realTotalPaddingY / scale;
  const viewboxHeight = natural.height + scaledTotalPaddingY;
  const top = computePadding(scaledTotalPaddingY, startPadding.y);
  const viewboxTop = -top;

  return {
    width: container.width,
    height: container.height,
    viewBox: `${viewboxLeft} ${viewboxTop} ${viewboxWidth} ${viewboxHeight}`,
    color,
  };
};
