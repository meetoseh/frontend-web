import { LayoutConfig } from '../../types/Config';
import { Locator } from '../../types/LayoutWorld';
import { WorldPoint } from '../../types/World';

/**
 * Lays the items out with the root at the top and then one column
 * per descendant, such that the result looks like
 *
 * ```txt
 *    A
 *  | | |
 *  v v v
 *  B C D
 * ```
 *
 * @param cfg The layout configuration to respect
 * @returns The locator for that configuration
 */
export const createStdVerticalLocator = (cfg: LayoutConfig): Locator => {
  return (items) => {
    if (items.length === 0) {
      return [];
    }

    if (items.length === 1) {
      return [{ x: 0, y: 0 }];
    }

    let descendantsWidth = 0;
    for (let i = 1; i < items.length; i++) {
      if (i > 1) {
        descendantsWidth += cfg.columnGap;
      }

      descendantsWidth += items[i].width;
    }

    const fullWidth = Math.max(items[0].width, descendantsWidth);
    const centerX = fullWidth / 2;

    const result: WorldPoint[] = [];
    result.push({
      x: centerX - items[0].width / 2,
      y: 0,
    });

    let x = centerX - descendantsWidth / 2;
    const y = items[0].height + cfg.rowGap;

    for (let i = 1; i < items.length; i++) {
      result.push({
        x,
        y,
      });

      x += items[i].width + cfg.columnGap;
    }

    return result;
  };
};
