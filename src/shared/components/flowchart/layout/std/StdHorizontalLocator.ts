import { LayoutConfig } from '../../types/Config';
import { Locator } from '../../types/LayoutWorld';
import { WorldPoint } from '../../types/World';

/**
 * Layouts out the items with the root on the left, and then
 * one row per descendant, such that the result looks like
 *
 * ```txt
 *   -> B
 * A -> C
 *   -> D
 * ```
 *
 * @param cfg The layout configuration to respect
 * @returns The locator for that configuration
 */
export const createStdHorizontalLocator = (cfg: LayoutConfig): Locator => {
  return (items) => {
    if (items.length === 0) {
      return [];
    }

    if (items.length === 1) {
      return [{ x: 0, y: 0 }];
    }

    let descendantsHeight = 0;
    for (let i = 1; i < items.length; i++) {
      if (i > 1) {
        descendantsHeight += cfg.rowGap;
      }

      descendantsHeight += items[i].height;
    }

    const fullHeight = Math.max(items[0].height, descendantsHeight);
    const centerY = fullHeight / 2;

    const result: WorldPoint[] = [];
    result.push({
      x: 0,
      y: centerY - items[0].height / 2,
    });

    let y = centerY - descendantsHeight / 2;
    const x = items[0].width + cfg.columnGap;

    for (let i = 1; i < items.length; i++) {
      result.push({
        x,
        y,
      });

      y += items[i].height + cfg.rowGap;
    }

    return result;
  };
};
