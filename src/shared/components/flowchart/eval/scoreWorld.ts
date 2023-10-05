import { World } from '../types/World';

/**
 * Provides a score for the given world, where worlds with a higher score
 * are preferred. The result is signed, meaning worlds can have a negative
 * score where mathematically convenient.
 *
 * Only scores between two worlds with the same map items are comparable.
 *
 * @param world The world to score
 * @returns The score for the world
 */
export const scoreWorld = (world: World): number => {
  // We will prefer worlds that use less height as a proxy for visual
  // compactness

  if (world.items.length === 0) {
    return 0;
  }

  let minY = Infinity;
  let maxY = -Infinity;

  let sumBlockTopY = 0;

  for (const item of world.items) {
    minY = Math.min(minY, item.loc.y);
    maxY = Math.max(maxY, item.loc.y + item.size.height);
    sumBlockTopY += item.loc.y;

    if (item.loc.x < 0 || item.loc.x > world.width) {
      return -Infinity;
    }
  }

  const height = maxY - minY;

  return -height - sumBlockTopY;
};
