import { LayoutConfig } from '../types/Config';
import { LayoutWorld, LayoutWorldItem } from '../types/LayoutWorld';
import { World, WorldItem, WorldSize } from '../types/World';
import { materializeConnections } from './materializeConnections';

/**
 * Converts the given layout world into an actual world, unless doing so
 * results in an invalid world, in which case null is returned.
 *
 * The returned world is guarranteed to preserve the order of items,
 * i.e., the first item in the layout world will be positioned and
 * assigned the first index in items in the returned world.
 *
 * @param world The layout world to materialize
 * @param cfg The configuration to respect
 * @returns The materialized world, or null if the layout world is invalid
 * @throws if the layout world is cyclical or has nodes with multiple parents
 */
export const materializeWorld = (world: LayoutWorld, cfg: LayoutConfig): World | null => {
  const roots = convertToTree(world);

  const materializedRoots: MaterializedItemWithIndex[][] = [];
  for (const root of roots) {
    const materializedRoot = materializeTreeRecursive(root);
    if (materializedRoot === null) {
      return null;
    }
    for (const val of materializedRoot) {
      if (
        val.item.loc.x < 0 ||
        val.item.loc.y < 0 ||
        (world.width !== 0 && val.item.loc.x + val.item.size.width > world.width)
      ) {
        return null;
      }
    }
    materializedRoots.push(materializedRoot);
  }

  // Now use the root locator to reposition each subtree
  const rootSizes: WorldSize[] = [];
  for (const root of materializedRoots) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const item of root) {
      minX = Math.min(minX, item.item.loc.x);
      maxX = Math.max(maxX, item.item.loc.x + item.item.size.width);
      minY = Math.min(minY, item.item.loc.y);
      maxY = Math.max(maxY, item.item.loc.y + item.item.size.height);
    }

    rootSizes.push({
      width: maxX - minX,
      height: maxY - minY,
    });
  }

  const positionedRoots = world.rootLocator(rootSizes, world.width);

  for (let i = 0; i < materializedRoots.length; i++) {
    const root = materializedRoots[i];
    const pos = positionedRoots[i];

    for (const item of root) {
      item.item.loc.x += pos.x;
      item.item.loc.y += pos.y;
    }
  }

  const itemsByIndex = new Map<number, WorldItem>();
  for (const root of materializedRoots) {
    for (const item of root) {
      itemsByIndex.set(item.index, item.item);
    }
  }

  const items: WorldItem[] = [];
  for (let i = 0; i < world.items.length; i++) {
    const item = itemsByIndex.get(i);
    if (item === undefined) {
      throw new Error(`Item ${i} is missing`);
    }
    items.push(item);
  }

  return materializeConnections({
    width: world.width,
    items,
    connections: world.connections,
    cfg,
  });
};

type ItemWithIndex = {
  /**
   * The item from the original layout world
   */
  item: LayoutWorldItem;
  /**
   * The index of the item within the original layout world
   */
  index: number;
};

type MaterializedItemWithIndex = {
  /**
   * The materialized item
   */
  item: WorldItem;

  /**
   * The index of the corresponding layout item in the original layout world
   */
  index: number;
};

type ItemsTree = ItemWithIndex & {
  /**
   * The immediate children of this item
   */
  children: ItemsTree[];
};

/**
 * Converts the given layout world into a list of trees, where
 * each tree corresponds to a root item and its descendants.
 *
 * @param world The layout world to convert
 * @throws If the items are cyclical
 * @throws If any item has more than one parent
 */
const convertToTree = (world: LayoutWorld): ItemsTree[] => {
  const itemsWithIndex = world.items.map((item, index) => ({ item, index }));
  const itemsByIndex = new Map<number, ItemWithIndex>(
    itemsWithIndex.map((item) => [item.index, item])
  );
  const parentByIndex = new Map<number, number>();
  const childrenByIndex = new Map<number, number[]>();

  for (let i = 0; i < world.connections.length; i++) {
    const conn = world.connections[i];
    if (parentByIndex.has(conn.to.item)) {
      throw new Error(`Item ${conn.to.item} has more than one parent`);
    }
    parentByIndex.set(conn.to.item, conn.from.item);

    let children = childrenByIndex.get(conn.from.item);
    if (children === undefined) {
      children = [];
      childrenByIndex.set(conn.from.item, children);
    }
    children.push(conn.to.item);
  }

  const result: ItemsTree[] = [];
  const seen = [0];

  for (const item of itemsWithIndex) {
    if (parentByIndex.has(item.index)) {
      continue;
    }

    const tree = convertToTreeRecursive(item.index, itemsByIndex, childrenByIndex, seen);
    result.push(tree);
  }

  return result;
};

const convertToTreeRecursive = (
  index: number,
  itemsByIndex: Map<number, ItemWithIndex>,
  childrenByIndex: Map<number, number[]>,
  seen: number[]
): ItemsTree => {
  seen[0] += 1;
  if (seen[0] > itemsByIndex.size) {
    throw new Error(`Items are cyclical`);
  }

  const item = itemsByIndex.get(index);
  if (item === undefined) {
    throw new Error(`Item ${index} does not exist`);
  }

  const children = childrenByIndex.get(index);
  if (children === undefined) {
    return {
      ...item,
      children: [],
    };
  }

  const result: ItemsTree[] = [];
  for (const child of children) {
    result.push(convertToTreeRecursive(child, itemsByIndex, childrenByIndex, seen));
  }

  return {
    ...item,
    children: result,
  };
};

const findMaterializedSize = (items: MaterializedItemWithIndex[]): WorldSize => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const item of items) {
    minX = Math.min(minX, item.item.loc.x);
    maxX = Math.max(maxX, item.item.loc.x + item.item.size.width);
    minY = Math.min(minY, item.item.loc.y);
    maxY = Math.max(maxY, item.item.loc.y + item.item.size.height);
  }

  return {
    width: maxX - minX,
    height: maxY - minY,
  };
};

const materializeTreeRecursive = (tree: ItemsTree): MaterializedItemWithIndex[] | null => {
  const children: MaterializedItemWithIndex[][] = [];

  for (let childIndex = 0; childIndex < tree.children.length; childIndex++) {
    const materializedChild = materializeTreeRecursive(tree.children[childIndex]);
    if (materializedChild === null) {
      return null;
    }
    children.push(materializedChild);
  }

  const descendants = children.map((childTree) => findMaterializedSize(childTree));
  const placement = tree.item.locator([tree.item.size, ...descendants]);

  if (placement === null) {
    return null;
  }

  const result: MaterializedItemWithIndex[] = [
    {
      item: {
        size: tree.item.size,
        loc: {
          x: placement[0].x,
          y: placement[0].y,
        },
      },
      index: tree.index,
    },
  ];

  for (let childIndex = 0; childIndex < children.length; childIndex++) {
    const childTree = children[childIndex];
    const childPlacement = placement[childIndex + 1];

    for (const child of childTree) {
      result.push({
        item: {
          size: child.item.size,
          loc: {
            x: childPlacement.x + child.item.loc.x,
            y: childPlacement.y + child.item.loc.y,
          },
        },
        index: child.index,
      });
    }
  }

  return result;
};
