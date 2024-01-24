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

export type CreateWorldYieldSettings = {
  /**
   * How long we can spend on the layout before yielding to the event loop,
   * in milliseconds
   * @default 3
   */
  maxIntervalBetweenYields: number;
  /**
   * How long we should yield to the event loop, 0 to request an animation frame
   * @default 0
   */
  yieldDuration: number;
};

export type CreateWorldSettingsOpts = {
  /**
   * Settings for yielding to the event loop, undefined for default yield settings,
   * null for no yielding
   * @default undefined
   */
  yieldSettings?: CreateWorldYieldSettings | null | undefined;

  /**
   * The signal to abort the layout
   */
  signal?: AbortSignal;
};

/**
 * Determines how to layout the given size tree. The resulting world is
 * guarranteed to have the items in preorder traversal order, then in
 * order of the trees.
 *
 * Although this is a synchronous calculation, we may yield to the
 * event loop regularly to avoid blocking the UI thread.
 *
 * @param cfg The layout configuration to respect
 * @param tree The size tree to layout; this describes both the sizes of
 *   items in the flow and their connections.
 * @param width The available width to use
 * @param opts Options for computing the layout
 */
export const createWorld = async (
  cfg: LayoutConfig,
  trees: SizeTree[],
  width: number,
  opts?: CreateWorldSettingsOpts
): Promise<World> => {
  const realYieldSettings =
    opts?.yieldSettings === undefined
      ? {
          maxIntervalBetweenYields: 3,
          yieldDuration: 0,
        }
      : opts.yieldSettings;
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
  let lastYieldedAt = performance.now();

  // undirected exhaustive search
  while (true) {
    if (opts?.signal?.aborted) {
      throw new Error('canceled');
    }

    if (realYieldSettings !== null) {
      if (performance.now() - lastYieldedAt > realYieldSettings.maxIntervalBetweenYields) {
        await new Promise((resolve) => {
          if (realYieldSettings.yieldDuration === 0) {
            requestAnimationFrame(resolve);
            return;
          }
          setTimeout(resolve, realYieldSettings.yieldDuration);
        });
        lastYieldedAt = performance.now();
      }
    }

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

/**
 * A faster, but much worse, version of createWorld. This is useful for
 * initializing the world before createWorld has finished.
 *
 * @param cfg The layout configuration to respect
 * @param tree The size tree to layout; this describes both the sizes of
 *  items in the flow and their connections.
 * @param width The available width to use
 */
export const createWorldFast = (cfg: LayoutConfig, trees: SizeTree[], width: number): World => {
  const [items, connections] = flattenTrees(trees);

  const rootLocators = createRootVariations(cfg, true);
  const stdLocators = createStdVariations(cfg, true);

  const stack: StackItem[] = [];

  for (const rootLocator of rootLocators) {
    stack.push({
      rootLocator,
      itemsSoFar: [],
      nextStdLocator: 0,
    });
  }

  // undirected exhaustive search, breaking as soon as we find a valid one
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

      return materialized;
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

  throw new Error('Could not layout world (maybe width is too small?)');
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
