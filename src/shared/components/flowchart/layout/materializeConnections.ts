import { LayoutConfig } from '../types/Config';
import { LayoutWorldConnection } from '../types/LayoutWorld';
import { World, WorldConnection, WorldItem, WorldPoint, WorldSize } from '../types/World';

/**
 * Materializes the connections between a world where all the items
 * have been positioned. This determines which anchor point to use
 * to connect items as well as the path for the arrows to take (which
 * is fully described using the anchors plus a midpoint)
 *
 * This is guarranteed to maintain the order of items and connections.
 *
 * @param width The width of the world
 * @param items The items in the world
 * @param connections The unmaterialized connections between items
 * @param layoutConfig The configuration to respect
 * @returns The world with the connections materialized
 * @throws If the connections cannot be materialized, e.g., because there
 *   is no path between two connected items
 */
export const materializeConnections = ({
  width,
  items,
  connections,
  cfg,
}: {
  width: number;
  items: WorldItem[];
  connections: LayoutWorldConnection[];
  cfg: LayoutConfig;
}): World => {
  const prepared = prepareWorld(items, cfg);
  const existingAnchors: ExistingAnchors = initExistingAnchors();
  return {
    width,
    items,
    connections: connections.map((conn) => {
      const result = materializeConnection(prepared, conn, existingAnchors);
      if (result === null) {
        throw new Error(`Could not connect ${conn.from.item} to ${conn.to.item}`);
      }
      const [from, to] = computeAnchorIds(prepared, result);
      addAnchor(existingAnchors, from, 'from');
      addAnchor(existingAnchors, to, 'to');
      return result;
    }),
  };
};

/**
 * Describes the world after preparation steps have been applied
 * to optimize the computations that will be required to materialize
 * the connections.
 */
type PreparedWorld = {
  items: WorldItem[];
  /**
   * The minor axis length when tracing along the given axis. This
   * is inverted from what you might expect, because if moving in
   * the x axis we want a space at least the row gap tall
   */
  minorAxisLengthByDir: { x: number; y: number };
};

type ExistingAnchors = Map<number, { from: number; to: number }>;

const initExistingAnchors = (): ExistingAnchors => new Map();

const getAnchorId = (idx: number, anchor: 0 | 1 | 2 | 3, crossAxisDirection: -1 | 0 | 1) =>
  idx * 12 + anchor * 3 + crossAxisDirection;

const computeAnchorIds = (world: PreparedWorld, conn: WorldConnection): [number, number] => {
  const fromPoint = getAnchorPoint(world.items[conn.from.item], conn.from.anchor)[0];
  const fromAxis = anchorToAxis(conn.from.anchor);
  const fromCrossAxis = otherAxis(fromAxis);

  const toPoint = getAnchorPoint(world.items[conn.to.item], conn.to.anchor)[0];
  const toAxis = anchorToAxis(conn.to.anchor);
  const toCrossAxis = otherAxis(toAxis);

  return [
    getAnchorId(
      conn.from.item,
      conn.from.anchor,
      Math.sign(toPoint[fromCrossAxis] - fromPoint[fromCrossAxis]) as -1 | 0 | 1
    ),
    getAnchorId(
      conn.to.item,
      conn.to.anchor,
      Math.sign(fromPoint[toCrossAxis] - toPoint[toCrossAxis]) as -1 | 0 | 1
    ),
  ];
};

const addAnchor = (
  existingAnchors: ExistingAnchors,
  anchorId: number,
  fromTo: 'from' | 'to'
): void => {
  const current = existingAnchors.get(anchorId);
  if (current === undefined) {
    existingAnchors.set(anchorId, { from: fromTo === 'from' ? 1 : 0, to: fromTo === 'to' ? 1 : 0 });
    return;
  }

  if (fromTo === 'from') {
    current.from++;
  } else {
    current.to++;
  }
};

/**
 * Performs any computations we want to do ahead of time to optimize
 * the materialization of connections.
 *
 * @param items The items in the world
 * @returns The prepared world
 */
const prepareWorld = (items: WorldItem[], cfg: LayoutConfig): PreparedWorld => ({
  items,
  minorAxisLengthByDir: {
    x: cfg.rowGap,
    y: cfg.columnGap,
  },
});

/**
 * Determines how long a rectangle whose base is centered at the given
 * point can be before it intersects any of the items in the world. The
 * result is "Infinity" if the rectangle can be arbitrarily long. If the
 * rectangle is not arbitrarily long, the second number is the minimum
 * distance along the primary axis after moving the maximum length before
 * it may be possible to start the rectangle again without intersecting
 * any items.
 *
 * @param world The prepared world
 * @param start The point to start from. For moving right in the x axis,
 *   this is the center-left of the rectangle. For moving down in the y axis,
 *   this is the center-top of the rectangle, etc.
 * @param minorAxisLength The length of the minor axis of the rectangle.
 *   When moving in the x axis this is the height, when moving in the y axis
 *   this is the width.
 * @param axis The axis to move along; when `x`, the result is the maximum
 *   width of the rectangle. When `y`, the result is the maximum height of
 *   the rectangle.
 */
const trace = (
  world: PreparedWorld,
  start: WorldPoint,
  minorAxisLength: number,
  axis: 'x' | 'y',
  direction: 1 | -1
): [number, number] => {
  // PERF: currently this is a basic brute force approach; theres probably
  // a much faster way to do this with the right choice of data structures

  const minAlongMinorAxis = start[otherAxis(axis)] - minorAxisLength / 2;
  const maxAlongMinorAxis = start[otherAxis(axis)] + minorAxisLength / 2;

  let maxDistance = Infinity;
  let jump = 0;
  for (const item of world.items) {
    if (item.loc[otherAxis(axis)] >= maxAlongMinorAxis) {
      continue;
    }

    if (item.loc[otherAxis(axis)] + item.size[dimensionOf(otherAxis(axis))] <= minAlongMinorAxis) {
      continue;
    }

    let distanceUntilIntersection: number;
    if (direction === -1) {
      if (item.loc[axis] >= start[axis]) {
        continue;
      }

      if (item.loc[axis] + item.size[dimensionOf(axis)] >= start[axis]) {
        // our start is inside the item; we'll need to jump past it
        return [0, start[axis] - item.loc[axis]];
      }

      // we are not currently intersecting with the item, but we will eventually
      distanceUntilIntersection = start[axis] - item.loc[axis] - item.size[dimensionOf(axis)];
    } else {
      if (item.loc[axis] + item.size[dimensionOf(axis)] <= start[axis]) {
        continue;
      }

      if (item.loc[axis] <= start[axis]) {
        return [0, item.loc[axis] + item.size[dimensionOf(axis)] - start[axis]];
      }

      distanceUntilIntersection = item.loc[axis] - start[axis];
    }

    if (distanceUntilIntersection < maxDistance) {
      maxDistance = distanceUntilIntersection;
      jump = item.size[dimensionOf(axis)];
    }
  }

  return [maxDistance, jump];
};

/**
 * Materializes a single connection by selecting anchor points and a midpoint
 * such that an arrow can be drawn without intersecting any of the items.
 *
 * Example:
 *
 * ```txt
 * A -> B
 * ```
 *
 * this connection could be materialized by selecting the right anchor of A,
 * the left anchor of B, and any midpoint shorter than the length of the
 * connection.
 *
 * Example:
 *
 * ```txt
 *   -> B
 * A -
 *   ---> C
 *   -    v
 *   -   wDw
 * ```
 *
 * here the midpoint on the A->B and A->C connections can be different because
 * of the width of D. In fact, the A->C connection could be materialized by
 * the right of A connecting to the top of C. This example is intended to show
 * that there is a lot of flexibility in connections that cannot be reasonably
 * captured during the layout step.
 *
 * This functions goal is to find three axis-aligned rectangles without
 * intersecting any of the items with the minimal overall area. There is
 * one degree of freedom within each set rectangles: the midpoint. This will
 * never create connections that require 4 rectangles, e.g., to go from the right
 * of B to the left of A, the left of A must be right of the right of B.
 *
 * This example shows where the three rectangles are connecting the right of B to
 * the left of A:
 *
 * ```txt
 * -------
 * -     -
 * -  B  -112
 * -     -  2  ---
 * -------  233-A-
 *             ---
 * ```
 *
 * Here's one with the bottom of B to the left of A:
 *
 * ```txt
 * -------
 * -     -
 * -  B  -
 * -     -
 * -------
 *   111
 *   2222222222
 *   -----  333
 *   -   -  333---
 *   - C -  333-A-
 *   -   -  333---
 *   -----
 * ```
 *
 * - The first rectangle connects the first anchor and the second rectangle.
 * - The second rectangle connects the first and third rectangle
 * - The third rectangle connects the second rectangle and the second anchor.
 *
 * The width of each rectangle must be at least the column gap and the height
 * must be at least the row gap
 *
 * To make this problem unambiguous, the following preferences are used, in
 * order (i.e., earlier preferences have precedence)
 *
 * - Prefer shorter paths
 * - Prefer paths that don't reuse anchors
 * - Prefer paths that start on horizontal anchors
 * - Prefer paths that end on horizontal anchors
 * - Prefer larger midpoints
 *
 * @param items The items on the world; the path will not intersect
 * @param conn the connection to materialize
 * @param existingAnchors the map of existing anchors to how many times they've
 *   been used, where anchors are described as itemIndex * 4 + anchor
 *
 * @returns The materialized connection, or `null` if no connection could be
 *   found
 */
const materializeConnection = (
  world: PreparedWorld,
  conn: LayoutWorldConnection,
  existingAnchors: ExistingAnchors
): WorldConnection | null => {
  const fromItem = world.items[conn.from.item];
  const toItem = world.items[conn.to.item];

  let best: ConnectionOption | null = null;
  for (const fromAnchor of ANCHORS) {
    for (const toAnchor of ANCHORS) {
      const opt = tryCreateConnection(
        world,
        fromItem,
        toItem,
        fromAnchor,
        toAnchor,
        conn.from.item,
        conn.to.item
      );
      if (
        opt !== null &&
        (best === null || compareConnectionOptions(opt, best, world, existingAnchors) < 0)
      ) {
        best = opt;
      }
    }
  }
  if (best === null) {
    return null;
  }
  return {
    from: {
      item: conn.from.item,
      anchor: best.fromAnchor,
    },
    to: {
      item: conn.to.item,
      anchor: best.toAnchor,
    },
    midpoint: best.midpoint,
  };
};

const ANCHORS = [0, 1, 2, 3] as const;

/**
 * Attempts to connect the two items at the given anchors, returning
 * the connection option if successful or null if not.
 */
const tryCreateConnection = (
  world: PreparedWorld,
  fromItem: WorldItem,
  toItem: WorldItem,
  fromAnchor: 0 | 1 | 2 | 3,
  toAnchor: 0 | 1 | 2 | 3,
  fromIndex: number,
  toIndex: number
): ConnectionOption | null => {
  const [srcPoint, srcAxis, srcDir] = getAnchorPoint(fromItem, fromAnchor);
  const [dstPoint, dstAxis] = getAnchorPoint(toItem, toAnchor);

  // regardless of if the point we're trying to get to is in direction of
  // source anchor, the only thing we can change is when we switch from
  // the source axis to the cross axis, thus that is the direction we are
  // scanning for a spot to switch in, then we verify the other two rectangles
  // are valid

  let minCrossAxis = Math.min(srcPoint[otherAxis(srcAxis)], dstPoint[otherAxis(srcAxis)]);
  let maxCrossAxis = Math.max(srcPoint[otherAxis(srcAxis)], dstPoint[otherAxis(srcAxis)]);

  const crossAxisWidth = Math.max(maxCrossAxis - minCrossAxis, world.minorAxisLengthByDir[srcAxis]);
  const crossAxisCenter = (minCrossAxis + maxCrossAxis) / 2;
  const crossAxis = otherAxis(srcAxis);

  minCrossAxis = crossAxisCenter - crossAxisWidth / 2;
  maxCrossAxis = crossAxisCenter + crossAxisWidth / 2;

  const requiredLength = world.minorAxisLengthByDir[otherAxis(srcAxis)];

  let crossoverDistance = 0;
  while (true) {
    const [distance, jump] = trace(
      world,
      {
        [srcAxis]: srcPoint[srcAxis] + crossoverDistance * srcDir,
        [otherAxis(srcAxis)]: crossAxisCenter,
      } as WorldPoint,
      crossAxisWidth,
      srcAxis,
      srcDir
    );

    if (distance < requiredLength) {
      crossoverDistance += distance + jump;
      continue;
    }

    const distance1 = trace(
      world,
      srcPoint,
      world.minorAxisLengthByDir[srcAxis],
      srcAxis,
      srcDir
    )[0];

    if (distance1 < crossoverDistance) {
      // definitely not possible as we can only make this rectangle
      // larger by increasing the crossover distance
      return null;
    }

    const rect2Start = {
      [srcAxis]: srcPoint[srcAxis] + crossoverDistance * srcDir + requiredLength * srcDir,
      [otherAxis(srcAxis)]: dstPoint[crossAxis],
    } as WorldPoint;

    const dirForRect2 = dstPoint[srcAxis] <= rect2Start[srcAxis] ? -1 : 1;

    const distance2 = trace(
      world,
      rect2Start,
      world.minorAxisLengthByDir[srcAxis],
      srcAxis,
      dirForRect2
    )[0];

    const requiredDistance2 = rectContains(
      rectFromCorners(
        {
          [srcAxis]: srcPoint[srcAxis] + crossoverDistance * srcDir,
          [otherAxis(srcAxis)]: crossAxisCenter - crossAxisWidth / 2,
        } as WorldPoint,
        {
          [srcAxis]: srcPoint[srcAxis] + crossoverDistance * srcDir + requiredLength * srcDir,
          [otherAxis(srcAxis)]: crossAxisCenter + crossAxisWidth / 2,
        } as WorldPoint
      ),
      dstPoint
    )
      ? 0
      : Math.abs(dstPoint[srcAxis] - rect2Start[srcAxis]) +
        (dstAxis === srcAxis ? 0 : world.minorAxisLengthByDir[otherAxis(srcAxis)] / 2);

    if (distance2 >= requiredDistance2) {
      return {
        fromAnchor,
        toAnchor,
        fromIndex,
        toIndex,
        midpoint: crossoverDistance + requiredLength / 2,
        area:
          crossoverDistance * world.minorAxisLengthByDir[srcAxis] +
          requiredLength * crossAxisWidth +
          requiredDistance2 * world.minorAxisLengthByDir[srcAxis],
      };
    }

    // If we're still undershooting it may be possible to get around the collision
    // by overshooting.

    if (srcDir === dirForRect2) {
      // we will jump the crossover to the far edge of B
      const farEdgeOfB =
        srcDir === -1
          ? toItem.loc[srcAxis]
          : toItem.loc[srcAxis] + toItem.size[dimensionOf(srcAxis)];

      const dist = Math.abs(farEdgeOfB - srcPoint[srcAxis]);
      if (isClose(dist, crossoverDistance)) {
        console.warn('undershoot -> overshoot check is invalid or very unlikely case hit');
        return null;
      }

      crossoverDistance = dist;
      continue;
    }

    // we've determined this connection isn't possible
    return null;
  }
};

/**
 * Determines where the given anchor point is on the given item
 * and the direction to leave the item from that anchor
 */
const getAnchorPoint = (
  item: WorldItem,
  anchor: 0 | 1 | 2 | 3
): [WorldPoint, 'x' | 'y', -1 | 1] => {
  if (anchor === 0) {
    return [
      {
        x: item.loc.x + item.size.width / 2,
        y: item.loc.y,
      },
      'y',
      -1,
    ];
  } else if (anchor === 1) {
    return [
      {
        x: item.loc.x + item.size.width,
        y: item.loc.y + item.size.height / 2,
      },
      'x',
      1,
    ];
  } else if (anchor === 2) {
    return [
      {
        x: item.loc.x + item.size.width / 2,
        y: item.loc.y + item.size.height,
      },
      'y',
      1,
    ];
  } else {
    return [
      {
        x: item.loc.x,
        y: item.loc.y + item.size.height / 2,
      },
      'x',
      -1,
    ];
  }
};

const otherAxis = (axis: 'x' | 'y'): 'x' | 'y' => {
  if (axis === 'x') {
    return 'y';
  }
  return 'x';
};

const dimensionOf = (axis: 'x' | 'y'): 'width' | 'height' => {
  if (axis === 'x') {
    return 'width';
  }

  return 'height';
};

const anchorToAxis = (anchor: 0 | 1 | 2 | 3): 'x' | 'y' => {
  return anchor === 0 || anchor === 2 ? 'y' : 'x';
};

type ConnectionOption = {
  fromIndex: number;
  toIndex: number;
  /* anchors: top/right/bottom/left */
  fromAnchor: 0 | 1 | 2 | 3;
  toAnchor: 0 | 1 | 2 | 3;
  midpoint: number;
  area: number;
};

/**
 * Compares two connection options, returning a negative value if a is better
 * than b, a positive value if b is better than a, and 0 if they are equivalent.
 */
const compareConnectionOptions = (
  a: ConnectionOption,
  b: ConnectionOption,
  prepared: PreparedWorld,
  existingAnchors: ExistingAnchors
): number => {
  const aAnchorIds = computeAnchorIds(prepared, {
    from: {
      item: a.fromIndex,
      anchor: a.fromAnchor,
    },
    to: {
      item: a.toIndex,
      anchor: a.toAnchor,
    },
    midpoint: a.midpoint,
  });
  const bAnchorIds = computeAnchorIds(prepared, {
    from: {
      item: b.fromIndex,
      anchor: b.fromAnchor,
    },
    to: {
      item: b.toIndex,
      anchor: b.toAnchor,
    },
    midpoint: b.midpoint,
  });
  const existingAFrom = existingAnchors.get(aAnchorIds[0])?.from ?? 0;
  const existingBFrom = existingAnchors.get(bAnchorIds[0])?.from ?? 0;

  if (existingAFrom !== existingBFrom) {
    return existingAFrom - existingBFrom;
  }

  const existingATo = existingAnchors.get(aAnchorIds[1])?.to ?? 0;
  const existingBTo = existingAnchors.get(bAnchorIds[1])?.to ?? 0;

  if (existingATo !== existingBTo) {
    return existingATo - existingBTo;
  }

  const existingAFromAny = existingAFrom + (existingAnchors.get(aAnchorIds[0])?.to ?? 0);
  const existingBFromAny = existingBFrom + (existingAnchors.get(bAnchorIds[0])?.to ?? 0);

  if (existingAFromAny !== existingBFromAny) {
    return existingAFromAny - existingBFromAny;
  }

  const existingAToAny = existingATo + (existingAnchors.get(aAnchorIds[1])?.from ?? 0);
  const existingBToAny = existingBTo + (existingAnchors.get(bAnchorIds[1])?.from ?? 0);

  if (existingAToAny !== existingBToAny) {
    return existingAToAny - existingBToAny;
  }

  // If there were other from anchors in the same general spot it generally looks
  // better to bunch them up

  const aFromNearbyAnchorIds = ([-1, 0, 1] as const).map((dir) =>
    getAnchorId(a.fromIndex, a.fromAnchor, dir)
  );
  const bFromNearbyAnchorIds = ([-1, 0, 1] as const).map((dir) =>
    getAnchorId(b.fromIndex, b.fromAnchor, dir)
  );
  const aFromTotal = aFromNearbyAnchorIds
    .map((id) => existingAnchors.get(id)?.from ?? 0)
    .reduce((a, b) => a + b, 0);
  const bFromTotal = bFromNearbyAnchorIds
    .map((id) => existingAnchors.get(id)?.from ?? 0)
    .reduce((a, b) => a + b, 0);

  if (aFromTotal !== bFromTotal) {
    return bFromTotal - aFromTotal;
  }

  if (!isClose(a.area, b.area)) {
    return a.area - b.area;
  }

  const aHorizStart = a.fromAnchor === 1 || a.fromAnchor === 3;
  const bHorizStart = b.fromAnchor === 1 || b.fromAnchor === 3;

  if (aHorizStart !== bHorizStart) {
    return aHorizStart ? -1 : 1;
  }

  const aHorizEnd = a.toAnchor === 1 || a.toAnchor === 3;
  const bHorizEnd = b.toAnchor === 1 || b.toAnchor === 3;

  if (aHorizEnd !== bHorizEnd) {
    return aHorizEnd ? -1 : 1;
  }

  if (isClose(a.midpoint, b.midpoint)) {
    return 0;
  }

  return a.midpoint - b.midpoint;
};

const isClose = (a: number, b: number): boolean => Math.abs(a - b) < 0.001;

const rectContains = (rect: WorldPoint & WorldSize, pos: WorldPoint): boolean => {
  return (
    pos.x >= rect.x &&
    pos.x <= rect.x + rect.width &&
    pos.y >= rect.y &&
    pos.y <= rect.y + rect.height
  );
};

const rectFromCorners = (a: WorldPoint, b: WorldPoint): WorldPoint & WorldSize => {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
};
