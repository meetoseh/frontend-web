import { WorldPoint, WorldSize } from './World';

/**
 * Describes something capable of assigning a relative location
 * to an item using only an item and its descendants, i.e,.
 * a bottom-up approach.
 *
 * Each descendant is referring to a different connection series
 * which have already been laid out and hence can be represented
 * using just a size.
 *
 * Example:
 *
 * When locating A in:
 *
 * ```txt
 * A -> B -> C
 * ```
 *
 * There will be one descendant, which is the size of B -> C.
 *
 * When locating A in
 *
 * ```txt
 *   -> B -> C
 * A -
 *   -
 *   - -> D
 *   -           -> G
 *   - -> E -> F -
 *               -> H
 * ```
 *
 * There will be three descendants, one for B -> C, one for D, and one for
 * the chain starting with E
 *
 * @param items The items to position relative to each other, where `items[0]`
 *   is the root node, and `items[1], items[2], ...` are its descendants
 * @returns The locations of each item, where `items[0]` is the root node,
 *   and `items[1], items[2], ...` are its descendants. May return `null`
 *   if this layout does not generalize to the given number of descendants.
 */
export type Locator = (items: WorldSize[]) => WorldPoint[] | null;

/**
 * Describes something capable of placing the root nodes of a world,
 * i.e., the nodes that have no parents.
 *
 * Each of the roots is described using a single size as they have
 * already been located using Locators.
 *
 * @param roots The sizes of the roots to place
 * @param width The available width
 * @returns The locations of each root
 */
export type RootLocator = (roots: WorldSize[], width: number) => WorldPoint[];

/**
 * Describes a world item within a world that hasn't finished laying out
 * yet
 */
export type LayoutWorldItem = {
  /**
   * The function we've assigned capable of positioning this item relative to
   * its descendants. Layout essentially consists of brute-force searching
   * the possible locators for the "best" one.
   */
  locator: Locator;

  /**
   * The items size. This is provided to the flowchart
   */
  size: WorldSize;
};

/**
 * Describes a connection in a world that hasn't finished laying out yet;
 * we decide the details of how to anchor the connection after we've
 * positioned the items
 */
export type LayoutWorldConnection = {
  from: { item: number };
  to: { item: number };
};

/**
 * Describes a world that hasn't finished laying out yet
 */
export type LayoutWorld = {
  /**
   * The drawable width in logical pixels. This is provided to the flow
   * chart.
   */
  width: number;

  /**
   * The items that have been placed on the world
   */
  items: LayoutWorldItem[];

  /**
   * The method of placing the root nodes
   */
  rootLocator: RootLocator;

  /**
   * The connections within the world and enough information to draw them
   * deterministically. Items are required to flow, i.e., there must not
   * be any cycles.
   */
  connections: LayoutWorldConnection[];
};
