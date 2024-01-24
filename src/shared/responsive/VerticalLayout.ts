/**
 * Describes the vertical height of a component within a responsive vertical
 * layout.
 */
export type VerticalLayoutItem = {
  /**
   * The minimum required height of this component.
   *
   * Prior to measuring, this is the expected minimum height of the component
   * assuming that all fonts are loaded, no custom client side styles are
   * applied, and no accessibility scaling (e.g., text scaling on ios) is
   * applied.
   *
   * After measuring, this will be set to the best known estimate of the real
   * minimum height of the component. Note that sometimes we don't ever measure
   * the real value because it doesn't end up being relevant; for example, if
   * using the estimated value of 100px we decide to render this at a height of
   * 150px and we measure and it really rendered at 150px, then we won't alter
   * the min height even if, had we tried to render it at 100px it would have
   * taken 125px and thus the real minimum height is 125px.
   */
  minHeight: number;

  /**
   * How the component should scale vertically if, after adding up all the
   * min heights of the components, there is still space left over. The key
   * is the priority of that scaling, where lower priority numbers are
   * applied before higher priority numbers.
   *
   * At least one component within the layout must have 1 priority value
   * with an undefined end height.
   */
  scaling: Record<
    number,
    | {
        /**
         * The height of the component after this scaling is applied. Scaling
         * is distributed proportionally within the priority level.
         *
         * For example, if minHeight is 100, and scaling is just 1: { end: 200 },
         * then 50% of the way through distributing all the height required for
         * all components to reach their end height at priority 1, this component
         * will have a height of 150.
         *
         * Note that adding or changing the height of any other component within
         * the layout will change the absolute window height before this end height
         * is reached.
         *
         * May be undefined if all of the following is true:
         * - There are no components within the layout which have a scaling with
         *   a higher-valued priority (i.e., less important), as they would never
         *   be reached
         * - All other components within the layout which have a scaling with this
         *   priority have an end height which is also undefined. This isn't strictly
         *   required, but simplifies reasoning about the end behavior
         */
        end?: number;
      }
    | undefined
  >;
};

/**
 * Describes a vertical layout. Must include all the vertical space.
 *
 * This type is meant to be as easy as possible to initialize, though
 * not generally very efficient to operate on directly.
 */
export type VerticalLayout<K extends string> = Record<K, VerticalLayoutItem>;

type BoundedItemHeight =
  | {
      type: 'fixed';
      value: number;
    }
  | {
      type: 'proportional';
      range: [number, number];
    };

type UnboundedItemHeight =
  | {
      type: 'fixed';
      value: number;
    }
  | {
      type: 'proportional';
      start: number;
    };

/**
 * Describes basic processing on a VerticalLayout to make it easier to
 * work with. This can be done with the original VerticalLayout or with
 * the altered version after measuring.
 */
export type ComputedVerticalLayout<K extends string> = {
  /**
   * The original configuration
   */
  config: VerticalLayout<K>;

  /**
   * The minimum height required to display all components within the layout at
   * their minimum height. Below this value we must scale components.
   */
  requiredHeight: number;

  /**
   * Ordered by ascending priority value, describes how to scale
   * to a given overall height.
   */
  finitePriorities: {
    /**
     * The priority value; this is not relevant for layout, but is
     * helpful for debugging
     */
    value: number;

    /**
     * The overall height at the end of this priority level. This is
     * in ascending order.
     */
    endHeight: number;

    /**
     * The amount of height distributed within this priority level,
     * inverted
     */
    invTotalHeight: number;

    /**
     * For each component, describes that component's height at this
     * priority level as either a fixed value or proportionally
     * across an interval.
     */
    heights: Record<K, BoundedItemHeight>;
  }[];

  unbounded: {
    /**
     * The priority level that is used for unbounded scaling. This
     * is not relevant for layout, but is helpful for debugging.
     */
    priority: number;

    /**
     * The overall height at the start of unbounded scaling
     */
    startHeight: number;

    /**
     * The number of items which are scaling proportionally
     */
    numProportional: number;

    /**
     * `1 / numProportional`; for each pixel of overall height,
     * this is the number of pixels that should be added to each
     * proportional item.
     */
    pxPerProportional: number;

    /**
     * The height of each component at this priority level, either as
     * a fixed value, or start + pxPerProportional * additionalPx
     */
    heights: Record<K, UnboundedItemHeight>;
  };
};

/**
 * Prepares the given vertical layout configuration to actually
 * be used for layout by converting it to a ComputedVerticalLayout.
 *
 * @param config The vertical layout configuration
 * @throws if the configuration is invalid
 */
export const prepareVerticalLayout = <K extends string>(
  config: VerticalLayout<K>
): ComputedVerticalLayout<K> => {
  const keys = Object.keys(config) as K[];

  let unboundedPriority: number | undefined = undefined;
  let highestBoundedPriority: number | undefined = undefined;
  let boundedPrioritiesSet: Set<number> = new Set();
  let minHeight = 0;

  for (let i = 0; i < keys.length; i++) {
    const item = config[keys[i]];
    minHeight += item.minHeight;

    const priorityKeys = Object.keys(item.scaling);
    for (let j = 0; j < priorityKeys.length; j++) {
      const priority = parseInt(priorityKeys[j]);
      const scaling = item.scaling[priority];
      if (scaling === undefined) {
        continue;
      }

      if (unboundedPriority !== undefined && priority > unboundedPriority) {
        throw new Error(
          `${keys[i]} has scaling with priority ${priority}, but there is unbounded priority ${unboundedPriority}`
        );
      }

      if (scaling.end === undefined) {
        if (highestBoundedPriority !== undefined && priority < highestBoundedPriority) {
          throw new Error(
            `${keys[i]} has scaling with unbounded priority ${priority}, but there is bounded priority ${highestBoundedPriority}`
          );
        }
        if (unboundedPriority !== undefined && priority !== unboundedPriority) {
          throw new Error(
            `${keys[i]} has scaling with unbounded priority ${priority}, but there is already unbounded priority ${unboundedPriority}`
          );
        }
        unboundedPriority = priority;
      } else {
        if (unboundedPriority !== undefined && priority === unboundedPriority) {
          throw new Error(
            `${keys[i]} has scaling with priority ${priority}, but there is already unbounded priority ${unboundedPriority}`
          );
        }

        if (highestBoundedPriority === undefined || priority > highestBoundedPriority) {
          highestBoundedPriority = priority;
        }
        boundedPrioritiesSet.add(priority);
      }
    }
  }

  if (unboundedPriority === undefined) {
    throw new Error('No unbounded priority found');
  }

  const sortedBoundedPriorities = Array.from(boundedPrioritiesSet).sort((a, b) => a - b);
  const finitePriorities: ComputedVerticalLayout<K>['finitePriorities'] = [];

  const currentItemHeights = new Map() as Omit<Map<K, number>, 'get'> & { get: (key: K) => number };
  for (let i = 0; i < keys.length; i++) {
    currentItemHeights.set(keys[i], config[keys[i]].minHeight);
  }

  let finalBoundedHeight = minHeight;
  for (let priorityIndex = 0; priorityIndex < sortedBoundedPriorities.length; priorityIndex++) {
    const priority = sortedBoundedPriorities[priorityIndex];

    let spaceDistributable = 0;
    const heights: Record<K, BoundedItemHeight> = {} as any;
    for (let i = 0; i < keys.length; i++) {
      const item = config[keys[i]];
      const scaling = item.scaling[priority];
      if (scaling === undefined) {
        heights[keys[i]] = { type: 'fixed', value: currentItemHeights.get(keys[i]) };
        continue;
      }

      if (scaling.end === undefined) {
        throw new Error('Invariant violation 1');
      }

      const currentHeight = currentItemHeights.get(keys[i]);
      if (scaling.end <= currentHeight) {
        throw new Error(
          `${keys[i]} at ${priority} was already ${currentHeight} but requested to scale to ${scaling.end}`
        );
      }

      spaceDistributable += scaling.end - currentHeight;
      heights[keys[i]] = { type: 'proportional', range: [currentHeight, scaling.end] };
      currentItemHeights.set(keys[i], scaling.end);
    }

    finalBoundedHeight += spaceDistributable;
    finitePriorities.push({
      value: priority,
      endHeight: finalBoundedHeight,
      invTotalHeight: 1 / spaceDistributable,
      heights,
    });
  }

  let numUnboundedProportional = 0;
  const unboundedHeights: Record<K, UnboundedItemHeight> = {} as any;

  for (let i = 0; i < keys.length; i++) {
    const item = config[keys[i]];
    const scaling = item.scaling[unboundedPriority];
    if (scaling === undefined) {
      unboundedHeights[keys[i]] = { type: 'fixed', value: currentItemHeights.get(keys[i]) };
      continue;
    }

    if (scaling.end !== undefined) {
      throw new Error('Invariant violation 2');
    }

    unboundedHeights[keys[i]] = { type: 'proportional', start: currentItemHeights.get(keys[i]) };
    numUnboundedProportional++;
  }

  if (numUnboundedProportional === 0) {
    throw new Error('Invariant violation 3');
  }

  return {
    config,
    requiredHeight: minHeight,
    finitePriorities,
    unbounded: {
      priority: unboundedPriority,
      startHeight: finalBoundedHeight,
      numProportional: numUnboundedProportional,
      pxPerProportional: 1 / numUnboundedProportional,
      heights: unboundedHeights,
    },
  };
};

/**
 * Uses the given computed vertical layout to determine the height of
 * the individual components given the overall height. Raises an error
 * if the overall height is less than the required height.
 *
 * @param config The computed vertical layout
 * @param height The overall height available
 * @returns the height of each component
 */
export const applyVerticalLayout = <K extends string>(
  config: ComputedVerticalLayout<K>,
  height: number
): Record<K, number> => {
  if (height < config.requiredHeight) {
    throw new Error(
      `applyVerticalLayout: height ${height} is less than required height ${config.requiredHeight}`
    );
  }

  const keys = Object.keys(config.config) as K[];
  const result = {} as Record<K, number>;

  const boundedIndex = config.finitePriorities.findIndex((p) => p.endHeight > height);
  if (boundedIndex < 0) {
    const extraSpace = height - config.unbounded.startHeight;
    const heightPerProportional = extraSpace * config.unbounded.pxPerProportional;
    for (let i = 0; i < keys.length; i++) {
      const info = config.unbounded.heights[keys[i]];
      if (info.type === 'fixed') {
        result[keys[i]] = info.value;
      } else {
        result[keys[i]] = info.start + heightPerProportional;
      }
    }
    return result;
  }

  const bounded = config.finitePriorities[boundedIndex];
  const extraSpace =
    boundedIndex === 0
      ? height - config.requiredHeight
      : height - config.finitePriorities[boundedIndex - 1].endHeight;
  const progress = extraSpace * bounded.invTotalHeight;

  for (let i = 0; i < keys.length; i++) {
    const info = bounded.heights[keys[i]];
    if (info.type === 'fixed') {
      result[keys[i]] = info.value;
    } else {
      result[keys[i]] = info.range[0] + (info.range[1] - info.range[0]) * progress;
    }
  }

  return result;
};

/**
 * Given measured minimum heights for each component, which may differ
 * from the expected minimum heights, produces the nearest equivalent
 * vertical layout configuration.
 *
 * This only supports min heights which are at least as large as the
 * expected min heights.
 *
 * @param base The base vertical layout configuration
 * @param newMinHeights The new minimum heights based on how the
 *   components are actually rendering
 * @returns The new vertical layout configuration
 */
export const updateForNewMinHeights = <K extends string>(
  base: VerticalLayout<K>,
  newMinHeights: Record<K, number>
): VerticalLayout<K> => {
  const keys = Object.keys(base) as K[];
  const result = {} as Record<K, VerticalLayoutItem>;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const item = base[key];
    const newMinHeight = newMinHeights[key];
    if (newMinHeight < item.minHeight) {
      throw new Error(`updateForNewMinHeights: new min height for ${key} is less than expected`);
    }

    // skip over scalings that no longer make sense
    let currentHeight = newMinHeight;
    const priorityKeys = Object.keys(item.scaling);
    const sortedPriorities = priorityKeys.map((k) => parseInt(k)).sort((a, b) => a - b);
    const newScaling = {} as VerticalLayoutItem['scaling'];

    for (let priorityIndex = 0; priorityIndex < sortedPriorities.length; priorityIndex++) {
      const priority = sortedPriorities[priorityIndex];
      const scaling = item.scaling[priority];
      if (scaling === undefined) {
        continue;
      }

      if (scaling.end === undefined) {
        newScaling[priority] = scaling;
        continue;
      }

      if (scaling.end <= currentHeight) {
        continue;
      }

      currentHeight = scaling.end;
      newScaling[priority] = scaling;
    }

    result[key] = {
      minHeight: newMinHeight,
      scaling: newScaling,
    };
  }

  return result;
};
