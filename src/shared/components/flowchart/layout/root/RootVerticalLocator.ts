import { LayoutConfig } from '../../types/Config';
import { RootLocator } from '../../types/LayoutWorld';
import { WorldPoint } from '../../types/World';

/**
 * Lays the roots out in a center-aligned single-column layout
 *
 * @param cfg The layout configuration to respect
 */
export const createRootVerticalLocator = (cfg: LayoutConfig): RootLocator => {
  return (roots, width: number) => {
    let y = 0;
    const result: WorldPoint[] = [];
    for (let i = 0; i < roots.length; i++) {
      result.push({
        x: width === 0 ? 0 : (width - roots[i].width) / 2,
        y,
      });

      y += roots[i].height + cfg.rowGap;
    }
    return result;
  };
};
