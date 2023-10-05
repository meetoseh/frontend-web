/**
 * Describes the layout configuration of a flowchart, i.e., the information
 * that must be specified in order to deterministically layout the components
 */
export type LayoutConfig = {
  /**
   * The number of pixels separating two components horizontally when they
   * overlap vertically
   */
  columnGap: number;

  /**
   * The number of pixels separating two components vertically when they
   * overlap horizontally
   */
  rowGap: number;

  /**
   * How many pixels we undershoot the "ideal" midpoint of a connection by,
   * which visually keeps lines distinct which are using the same midpoint but
   * are coming at it from different directions
   */
  undershootMidpointsBy: number;
};

/**
 * Describes the rendering configuration of a flowchart, i.e., the information
 * that must be specified in order to deterministically render the components
 */
export type RenderConfig = {
  /**
   * The width of lines in logical pixels
   */
  lineThickness: number;

  /**
   * The color of lines, as [0-1, 0-1, 0-1, 0-1] for
   * red, green, blue, and alpha.
   */
  color: [number, number, number, number];

  /**
   * The gap between where an arrow starts/ends and the actual
   * anchor it is connected to, in logical pixels.
   */
  arrowItemGap: {
    /**
     * The gap between the anchor and the start of the arrow,
     * in logical pixels
     */
    tail: number;

    /**
     * The gap between the anchor and the end of the arrow,
     * in logical pixels
     */
    head: number;
  };

  /**
   * The size of the arrow head lines in logical pixels.
   */
  arrowHeadLength: number;

  /**
   * The angle for the arrow head in degrees.
   */
  arrowHeadAngleDeg: number;
};

/**
 * Describes all the required configuration to deterministically
 * layout and render a flowchart
 */
export type Config = {
  /**
   * The layout configuration of the flowchart
   */
  layout: LayoutConfig;

  /**
   * The rendering configuration of the flowchart
   */
  render: RenderConfig;
};
