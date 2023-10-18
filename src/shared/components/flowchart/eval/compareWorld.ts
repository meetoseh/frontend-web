import { World, WorldItem } from '../types/World';

/**
 * Compares two worlds which have the same map items.
 *
 * @param a The first world
 * @param b The second world
 * @returns A negative number if `a` is preferred, a positive number if `b` is
 *       preferred, or zero if they are equally preferred
 */
export const compareWorlds = (a: World, b: World): number => {
  const splitsA = countBadSplits(a);
  const splitsB = countBadSplits(b);
  if (splitsA !== splitsB) {
    return splitsA - splitsB;
  }
  return getWorldHeight(a) - getWorldHeight(b);
};

const getWorldHeight = (world: World): number => {
  if (world.items.length === 0) {
    return 0;
  }

  let minY = Infinity;
  let maxY = -Infinity;

  for (const item of world.items) {
    minY = Math.min(minY, item.loc.y);
    maxY = Math.max(maxY, item.loc.y + item.size.height);

    if (item.loc.x < 0 || item.loc.x > world.width) {
      return -Infinity;
    }
  }

  return maxY - minY;
};

/**
 * A split is when a single item has multiple children. The split is
 * bad if the item and its children share a value along an axis,
 * and good if they differ on both axes.
 */
const countBadSplits = (world: World): number => {
  const roots = createTree(world);
  return roots.map(countBadSplitsRecursively).reduce((a, b) => a + b, 0);
};

const countBadSplitsRecursively = (tree: Tree): number => {
  let result = 0;

  if (tree.children.length > 1 && tree.children.some((c) => haveSharedAxis(tree.item, c.item))) {
    result++;
  }

  return result + tree.children.map(countBadSplitsRecursively).reduce((a, b) => a + b, 0);
};

const haveSharedAxis = (a: WorldItem, b: WorldItem): boolean => {
  const aCenterX = a.loc.x + a.size.width / 2;
  const bCenterX = b.loc.x + b.size.width / 2;
  const aCenterY = a.loc.y + a.size.height / 2;
  const bCenterY = b.loc.y + b.size.height / 2;

  return isClose(aCenterX, bCenterX) || isClose(aCenterY, bCenterY);
};

const isClose = (a: number, b: number): boolean => {
  return Math.abs(a - b) < 1e-6;
};

type Tree = {
  item: WorldItem;
  children: Tree[];
};

const createTree = (world: World): Tree[] => {
  const result: Tree[] = [];
  const children = new Set<number>();

  for (const conn of world.connections) {
    children.add(conn.to.item);
  }

  for (let idx = 0; idx < world.items.length; idx++) {
    if (children.has(idx)) {
      continue;
    }

    createTreeRecursively(world, world.items[idx], idx, result);
  }

  return result;
};

const createTreeRecursively = (
  world: World,
  item: WorldItem,
  itemIndex: number,
  result: Tree[]
) => {
  const children: Tree[] = [];
  result.push({ item, children });

  for (const conn of world.connections) {
    if (conn.from.item !== itemIndex) {
      continue;
    }

    createTreeRecursively(world, world.items[conn.to.item], conn.to.item, children);
  }
};
