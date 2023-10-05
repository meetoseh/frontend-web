import { LayoutConfig } from '../../types/Config';
import { Locator } from '../../types/LayoutWorld';
import { WorldPoint } from '../../types/World';

/**
 * Creates a layout configuration where there is one row per descendant,
 * but each descendant is placed left-aligned with the root, to ensure
 * that they have all the space they need. The result looks like:
 *
 * ```txt
 * A
 * B
 * C
 * D
 * ```
 *
 * This is primarily used for mobile where it's generally never possible to
 * have more than one column.
 *
 * @param cfg The layout configuration to respect
 * @returns The locator for that configuration
 */
export const createStdColumnLocator = (cfg: LayoutConfig): Locator => {
  return (items) => {
    let y = 0;
    const x = 0;

    const result: WorldPoint[] = [];
    for (let i = 0; i < items.length; i++) {
      result.push({
        x,
        y,
      });

      y += items[i].height + cfg.rowGap;
    }

    return result;
  };
};
