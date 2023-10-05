import { ReactElement } from 'react';
import { World, WorldItem, WorldPoint, WorldSize } from '../types/World';
import { Config } from '../types/Config';
import { ValueWithCallbacks } from '../../../lib/Callbacks';
import { useMappedValuesWithCallbacks } from '../../../hooks/useMappedValuesWithCallbacks';
import { useMappedValueWithCallbacks } from '../../../hooks/useMappedValueWithCallbacks';
import { SizeTree, createWorld } from '../createWorld';
import { RenderGuardedComponent } from '../../RenderGuardedComponent';
import { Arrow } from './Arrow';

type ElementAndSize = {
  /**
   * The element to draw
   */
  element: ReactElement;
  /**
   * The size of the container for the element
   */
  size: WorldSize;
};
/**
 * Describes a node within the flow chart tree, where each node
 * consists of a react element that can be drawn in a container
 * of the given size
 */
export type ElementAndSizeTree = ElementAndSize & {
  /**
   * The children of this node, which must not cause cycles
   * or a node with multiple parents
   */
  children: ElementAndSizeTree[];
};

/**
 * The properties that can be rendered as a flow chart without
 * needing to do any inspection of the elements
 */
export type FlowChartGivenSizesProps = {
  /**
   * The configuration used to guide the flow chart layout and
   * rendering
   */
  cfg: Config;

  /**
   * The roots to render in the flow chart, where each root corresponds
   * to an item with no parents. Specifyiing multiple roots within a
   * single chart vs multiple charts can result in slightly nicer layouts,
   * but keep in mind that the performance cost is about O(4^n) where n is the
   * the total number of nodes, so realistically 8-10 nodes in total is the
   * limit for a single chart
   */
  roots: ElementAndSizeTree[];

  /**
   * The width to use for the flow chart
   */
  width: number;
};

export const FlowChartGivenSizes = ({
  props,
}: {
  props: ValueWithCallbacks<FlowChartGivenSizesProps>;
}): ReactElement => {
  const world = useMappedValueWithCallbacks(props, ({ width, cfg, roots }): World => {
    return createWorld(cfg.layout, convertToSizeTree(roots), width);
  });
  const flattenedItems = useMappedValueWithCallbacks(props, ({ roots }) =>
    flattenElementAndSizeTree(roots)
  );

  const materializedProps = useMappedValuesWithCallbacks(
    [props, world, flattenedItems],
    (): MaterializedRendererProps => ({
      items: flattenedItems.get(),
      world: world.get(),
      cfg: props.get().cfg,
      width: props.get().width,
    })
  );

  return (
    <RenderGuardedComponent
      props={materializedProps}
      component={(p) => <MaterializedRenderer {...p} />}
    />
  );
};

type MaterializedRendererProps = {
  items: ElementAndSize[];
  world: World;
  cfg: Config;
  width: number;
};

const MaterializedRenderer = ({ items, world, cfg, width }: MaterializedRendererProps) => {
  let maxY = 0;
  for (const item of world.items) {
    maxY = Math.max(maxY, item.loc.y + item.size.height);
  }
  return (
    <div
      style={{
        position: 'relative',
        height: `${maxY}px`,
      }}>
      <div
        style={{
          position: 'absolute',
          left: '0',
          top: '0',
          width: '100%',
          height: `${maxY}px`,
        }}>
        {world.items.map((item, i) => {
          return (
            <div
              style={{
                position: 'absolute',
                left: `${item.loc.x}px`,
                top: `${item.loc.y}px`,
              }}
              key={i}>
              {items[i].element}
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: 'absolute',
          left: '0',
          top: '0',
          width: '100%',
          height: `${maxY}px`,
          pointerEvents: 'none',
        }}>
        {world.connections.map((conn, i) => {
          return (
            <Arrow
              key={i}
              cfg={cfg}
              props={{
                from: {
                  pos: getAnchorPoint(world.items[conn.from.item], conn.from.anchor),
                  dir: conn.from.anchor,
                },
                to: {
                  pos: getAnchorPoint(world.items[conn.to.item], conn.to.anchor),
                  dir: conn.to.anchor,
                },
                midpoint: conn.midpoint,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

const convertToSizeTree = (roots: ElementAndSizeTree[]): SizeTree[] => {
  return roots.map(convertToSizeTreeRecursively);
};

const convertToSizeTreeRecursively = (item: ElementAndSizeTree): SizeTree => {
  return {
    width: item.size.width,
    height: item.size.height,
    children: item.children.map(convertToSizeTreeRecursively),
  };
};

const flattenElementAndSizeTree = (roots: ElementAndSizeTree[]): ElementAndSize[] => {
  const result: ElementAndSize[] = [];
  for (const root of roots) {
    flattenElementAndSizeTreeRecursively(root, result);
  }
  return result;
};

const flattenElementAndSizeTreeRecursively = (item: ElementAndSizeTree, out: ElementAndSize[]) => {
  out.push(item);
  for (const child of item.children) {
    flattenElementAndSizeTreeRecursively(child, out);
  }
};

/**
 * Determines where the given anchor point is on the given item
 */
const getAnchorPoint = (item: WorldItem, anchor: 0 | 1 | 2 | 3): WorldPoint => {
  if (anchor === 0) {
    return {
      x: item.loc.x + item.size.width / 2,
      y: item.loc.y,
    };
  } else if (anchor === 1) {
    return {
      x: item.loc.x + item.size.width,
      y: item.loc.y + item.size.height / 2,
    };
  } else if (anchor === 2) {
    return {
      x: item.loc.x + item.size.width / 2,
      y: item.loc.y + item.size.height,
    };
  } else {
    return {
      x: item.loc.x,
      y: item.loc.y + item.size.height / 2,
    };
  }
};
