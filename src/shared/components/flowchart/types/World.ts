/**
 * An arbitrary location on the world
 */
export type WorldPoint = {
  /**
   * The x-coordinate, relative to the top-left of the world
   */
  x: number;

  /**
   * The y-coordinate, relative to the top-left of the world
   */
  y: number;
};

/**
 * The size of something in the world as square
 */
export type WorldSize = {
  /**
   * The width of the item in logical pixels
   */
  width: number;

  /**
   * The height of the item in logical pixels
   */
  height: number;
};

/**
 * Describes a block within the flowchart, which can be connected with
 * other blocks via connections.
 */
export type WorldItem = {
  /**
   * The items top left corner. This is selected by the flowchart.
   */
  loc: WorldPoint;

  /**
   * The items size. This is provided to the flowchart
   */
  size: WorldSize;
};

export type WorldAnchor = {
  /**
   * The index of the item the anchor belongs to
   */
  item: number;

  /**
   * The index of the anchor within the item, where 0 is top,
   * 1 is right, 2 is bottom, and 3 is left.
   */
  anchor: 0 | 1 | 2 | 3;
};

/**
 * Describes a connection between two world items represented via an arrow.
 */
export type WorldConnection = {
  /**
   * The anchor point the arrow starts from
   */
  from: WorldAnchor;

  /**
   * The anchor point the arrow ends at
   */
  to: WorldAnchor;

  /**
   * The midpoint used for bending the arrow. Arrows are formed
   * from axis-aligned line segments. If the arrow starts from the
   * left or right side of the item then its primary axis is horizontal
   * and its cross axis is vertical. If the arrow starts from the top
   * or bottom side of the item then its primary axis is vertical and
   * its cross axis is horizontal.
   *
   * This midpoint is specified as an offset relative to the from
   * anchor in the primary axis.
   *
   * Ex: If the arrow starts from the left side of the item and the
   * the midpoint is -20px, the arrow moves left 20px, then up/down
   * to the to anchor, then left/right to the anchor, then draws the
   * head
   */
  midpoint: number;
};

/**
 * Describes the location on which the flowchart has been placed.
 * "Canvas" would be a good word here if it wasn't already taken
 * by the canvas element, which we are not using. "Map" might also
 * be agood word if it wasn't already taken by the built-in
 *
 * PERF:
 *   Currently I'm not sure what algorithm will produce the best
 *   results visually, hence I haven't included any lookups or
 *   optimized data structures for the world. Once satisfied with
 *   the results, if performance is an issue, there are a lot of
 *   brute force operations that could be greatly improved with
 *   datastructures more suited to the task.
 */
export type World = {
  /**
   * The drawable width in logical pixels. This is provided to the flow
   * chart.
   */
  width: number;

  /**
   * The items that have been placed on the world
   */
  items: WorldItem[];

  /**
   * The connections within the world and enough information to draw them
   * deterministically. Items are required to flow, i.e., there must not
   * be any cycles.
   */
  connections: WorldConnection[];
};
