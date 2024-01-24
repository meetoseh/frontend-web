import { LayoutConfig } from '../types/Config';
import { Locator, RootLocator } from '../types/LayoutWorld';
import { createRootVerticalLocator } from './root/RootVerticalLocator';
import { createStdColumnLocator } from './std/StdColumnLocator';
import { createStdHorizontalLocator } from './std/StdHorizontalLocator';
import { createStdVerticalLocator } from './std/StdVerticalLocator';

/**
 * Creates all the root locators that should be tried for the given configuration
 *
 * @param cfg The layout configuration to respect
 * @param fast A hint to prefer faster root locators over more visually appealing ones
 * @returns The root locators for that configuration
 */
export const createRootVariations = (cfg: LayoutConfig, fast?: boolean): RootLocator[] => {
  return [createRootVerticalLocator(cfg)];
};

/**
 * Creates all the standard locators that should be tried for each item in the tree
 * based on the given configuration
 *
 * @param cfg The layout configuration to respect
 * @param fast A hint to prefer faster locators over more visually appealing ones
 * @returns The locators for that configuration
 */
export const createStdVariations = (cfg: LayoutConfig, fast?: boolean): Locator[] => {
  if (fast) {
    return [createStdColumnLocator(cfg)];
  }

  return [
    createStdHorizontalLocator(cfg),
    createStdVerticalLocator(cfg),
    createStdColumnLocator(cfg),
  ];
};
