import { compareWorlds } from './eval/compareWorld';
import { materializeWorld } from './layout/materializeWorld';
import { createRootVariations, createStdVariations } from './layout/variations';
import { LayoutConfig } from './types/Config';
import { LayoutWorldConnection, LayoutWorldItem, RootLocator } from './types/LayoutWorld';
import { World, WorldSize } from './types/World';

/**
 * Describes the items to layout and their connections via a tree
 * structure. Must not have cycles
 */
export type SizeTree = WorldSize & {
  children: SizeTree[];
};

type StackItem = {
  rootLocator: RootLocator;
  itemsSoFar: LayoutWorldItem[];
  nextStdLocator: number;
};

/**
 * Determines how to layout the given size tree. The resulting world is
 * guarranteed to have the items in preorder traversal order, then in
 * order of the trees.
 *
 * @param cfg The layout configuration to respect
 * @param tree The size tree to layout; this describes both the sizes of
 *   items in the flow and their connections.
 * @param width The available width to use
 */
export const createWorld = (cfg: LayoutConfig, trees: SizeTree[], width: number): World => {
  const [items, connections] = flattenTrees(trees);

  const rootLocators = createRootVariations(cfg);
  const stdLocators = createStdVariations(cfg);

  const stack: StackItem[] = [];

  for (const rootLocator of rootLocators) {
    stack.push({
      rootLocator,
      itemsSoFar: [],
      nextStdLocator: 0,
    });
  }

  let bestWorld: World | null = null;

  // undirected exhaustive search
  while (true) {
    const nextItem = stack.pop();
    if (nextItem === undefined) {
      break;
    }

    if (nextItem.itemsSoFar.length === items.length) {
      const materialized = materializeWorld(
        {
          width,
          items: nextItem.itemsSoFar,
          rootLocator: nextItem.rootLocator,
          connections,
        },
        cfg
      );

      if (materialized === null) {
        continue;
      }

      if (bestWorld === null || compareWorlds(materialized, bestWorld) < 0) {
        bestWorld = materialized;
      }
      continue;
    }

    stack.push({
      rootLocator: nextItem.rootLocator,
      itemsSoFar: [
        ...nextItem.itemsSoFar,
        {
          locator: stdLocators[nextItem.nextStdLocator],
          size: items[nextItem.itemsSoFar.length],
        },
      ],
      nextStdLocator: 0,
    });

    if (nextItem.nextStdLocator + 1 < stdLocators.length) {
      stack.push({
        rootLocator: nextItem.rootLocator,
        itemsSoFar: nextItem.itemsSoFar,
        nextStdLocator: nextItem.nextStdLocator + 1,
      });
    }
  }

  if (bestWorld === null) {
    throw new Error('Could not layout world (maybe width is too small?)');
  }

  return bestWorld;
};

const flattenTrees = (trees: SizeTree[]): [WorldSize[], LayoutWorldConnection[]] => {
  const items: WorldSize[] = [];
  const connections: LayoutWorldConnection[] = [];

  for (const tree of trees) {
    const [treeItems, treeConnections] = flattenTree(tree);
    items.push(...treeItems);
    connections.push(...treeConnections);
  }

  return [items, connections];
};

const flattenTree = (tree: SizeTree): [WorldSize[], LayoutWorldConnection[]] => {
  const items: WorldSize[] = [];
  const connections: LayoutWorldConnection[] = [];
  flattenTreeRecursive(tree, items, connections);
  return [items, connections];
};

const flattenTreeRecursive = (
  tree: SizeTree,
  items: WorldSize[],
  connections: LayoutWorldConnection[]
): void => {
  const index = items.length;
  items.push({
    width: tree.width,
    height: tree.height,
  });

  for (const child of tree.children) {
    connections.push({
      from: { item: index },
      to: { item: items.length },
    });
    flattenTreeRecursive(child, items, connections);
  }
};
