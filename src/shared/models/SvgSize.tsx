/**
 * Svgs are infinitely scalable but will appear squished or stretched if the
 * aspect ratio its rendered at doesn't match the viewbox, hence they are specified
 * either by width or by height but not both.
 */
export type SvgRequestedSize =
  | {
      width: number;
      height?: undefined;
    }
  | {
      width?: undefined;
      height: number;
    };

/**
 * Computes the [width, height] of an svg requested to render at the given
 * width or the given height and which has a viewbox of the given width and
 * height.
 */
export const computeSvgSize = ({
  requested,
  viewbox,
}: {
  requested: SvgRequestedSize;
  viewbox: { width: number; height: number };
}) => {
  const numeric = computeSvgSizeNumeric({ requested, viewbox });
  return [`${numeric.width}px`, `${numeric.height}px`];
};

/**
 * Computes the [width, height] of an svg requested to render at the given
 * width or the given height and which has a viewbox of the given width and
 * height.
 */
export const computeSvgSizeNumeric = ({
  requested,
  viewbox,
}: {
  requested: SvgRequestedSize;
  viewbox: { width: number; height: number };
}): { width: number; height: number } => {
  if (requested.width === undefined) {
    return { width: (viewbox.width / viewbox.height) * requested.height, height: requested.height };
  }

  return { width: requested.width, height: (viewbox.height / viewbox.width) * requested.width };
};
