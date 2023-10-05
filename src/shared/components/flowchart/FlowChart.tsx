import { ReactElement, useEffect } from 'react';
import { Config } from './types/Config';
import {
  Callbacks,
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../lib/Callbacks';
import { WorldSize } from './types/World';
import { setVWC } from '../../lib/setVWC';
import { ElementAndSizeTree, FlowChartGivenSizes } from './render/FlowChartGivenSizes';
import { useMappedValuesWithCallbacks } from '../../hooks/useMappedValuesWithCallbacks';
import { useValueWithCallbacksEffect } from '../../hooks/useValueWithCallbacksEffect';

export type ElementTree = {
  /**
   * The element to render. The size of the element when given the entire
   * width of the flowchart will be used as the size of the element, so
   * it's often helpful to set a reasonable max width
   */
  element: ReactElement;

  /**
   * The children of this node, which must not cause cycles or nodes to
   * have multiple parents
   */
  children: ElementTree[];
};

export type FlowChartProps = {
  /**
   * The tree to render
   */
  tree: ElementTree;

  /**
   * The configuration to use or undefined for the default
   */
  cfg?: Config;
};

/**
 * The default recommended configuration options
 */
export const DefaultConfig: Config = {
  layout: {
    columnGap: 48,
    rowGap: 48,
    undershootMidpointsBy: 4,
  },
  render: {
    lineThickness: 2,
    color: [0, 0, 0, 0.5],
    arrowItemGap: {
      head: 4,
      tail: 4,
    },
    arrowHeadLength: 8,
    arrowHeadAngleDeg: 30,
  },
};

/**
 * Renders a flowchart from the given tree
 *
 * Flow charts always fill the available width, but the height is computed
 */
export const FlowChart = ({ tree, cfg = DefaultConfig }: FlowChartProps): ReactElement => {
  // TODO: this doesn't handle the # of nodes changing
  const widthVWC = useWritableValueWithCallbacks<number>(() => 0);
  const containerRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);

  useValueWithCallbacksEffect(containerRef, (ref) => {
    if (ref === null) {
      setVWC(widthVWC, 0);
      return undefined;
    }

    const ele = ref;
    let timeout: NodeJS.Timeout | null = null;
    setVWC(widthVWC, ele.getBoundingClientRect().width);

    const onDebounced = () => {
      timeout = null;
      setVWC(widthVWC, ele.getBoundingClientRect().width);
      ele.setAttribute('data-width', widthVWC.get().toString());
    };

    const handler = () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(onDebounced, 100);
    };

    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(handler);
      resizeObserver.observe(ele);
      return () => {
        resizeObserver.disconnect();
        if (timeout !== null) {
          clearTimeout(timeout);
          timeout = null;
        }
      };
    }

    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('resize', handler);
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    };
  });

  const childSizes = useWritableValueWithCallbacks<WorldSize[]>(() => {
    const result: WorldSize[] = [];
    getInitialSizesRecursively(tree, result);
    return result;
  });

  const childRefs = useWritableValueWithCallbacks<(HTMLDivElement | null)[]>(() => {
    return childSizes.get().map(() => null);
  });

  useEffect(() => {
    let running = true;
    const cancelers = new Callbacks<undefined>();
    registerSizeListeners();
    updateSizes();
    return () => {
      if (running) {
        running = false;
        cancelers.call(undefined);
      }
    };

    function getSizeOf(ref: HTMLDivElement | null): WorldSize {
      if (ref === null) {
        return { width: 50, height: 50 };
      }

      const { width, height } = ref.getBoundingClientRect();
      return { width, height };
    }

    function updateSizes() {
      const newSizes = childRefs.get().map(getSizeOf);

      if (!running) {
        return;
      }

      setVWC(
        childSizes,
        newSizes,
        (a, b) => a.length === b.length && a.every((size, i) => sizeEquals(size, b[i]))
      );
    }

    function registerSizeListeners() {
      if (!window.ResizeObserver) {
        return;
      }

      for (let i = 0; i < childRefs.get().length; i++) {
        registerSizeListener(i);
      }
    }

    function registerSizeListener(index: number) {
      const resizeObserver = new ResizeObserver((entries) => {
        if (!running) {
          return;
        }

        updateSizes();
      });

      if (!running) {
        return;
      }

      let observing: HTMLDivElement | null = null;
      cancelers.add(() => resizeObserver.disconnect());
      cancelers.add(() => childRefs.callbacks.remove(onChildRefsChanged));

      childRefs.callbacks.add(onChildRefsChanged);
      onChildRefsChanged();

      function onChildRefsChanged() {
        const newRef = childRefs.get()[index];

        if (observing === newRef) {
          return;
        }

        if (observing !== null) {
          resizeObserver.unobserve(observing);
        }

        if (newRef !== null) {
          resizeObserver.observe(newRef);
        }

        observing = newRef;
      }
    }
  }, [childRefs, childSizes]);

  return (
    <div
      style={{
        width: '100%',
        paddingTop: `${cfg.layout.rowGap}px`,
        paddingBottom: `${cfg.layout.rowGap}px`,
        paddingLeft: `${cfg.layout.columnGap}px`,
        paddingRight: `${cfg.layout.columnGap}px`,
      }}
      ref={(ref) => {
        setVWC(containerRef, ref);
      }}>
      <FlowChartGivenSizes
        props={useMappedValuesWithCallbacks([childSizes, widthVWC], () => ({
          cfg,
          roots: [convertTreeRecursively(childRefs, childSizes, tree, [-1])],
          width: Math.max(widthVWC.get() - 2 * cfg.layout.columnGap, 0),
        }))}
      />
    </div>
  );
};

const convertTreeRecursively = (
  childRefs: WritableValueWithCallbacks<(HTMLDivElement | null)[]>,
  childSizes: ValueWithCallbacks<WorldSize[]>,
  tree: ElementTree,
  idx: number[]
): ElementAndSizeTree => {
  idx[0]++;
  const myIndex = idx[0];
  const element = (
    <div
      key={idx[0]}
      ref={(ref) => {
        if (childRefs.get()[myIndex] !== ref) {
          childRefs.get()[myIndex] = ref;
          childRefs.callbacks.call(undefined);
        }
      }}>
      {tree.element}
    </div>
  );

  return {
    element,
    size: childSizes.get()[idx[0]],
    children: tree.children.map((child) =>
      convertTreeRecursively(childRefs, childSizes, child, idx)
    ),
  };
};

const getInitialSizesRecursively = (tree: ElementTree, result: WorldSize[]) => {
  result.push({ width: 50, height: 50 });
  tree.children.forEach((child) => getInitialSizesRecursively(child, result));
};

const sizeEquals = (a: WorldSize, b: WorldSize) => {
  return isClose(a.width, b.width) && isClose(a.height, b.height);
};

const isClose = (a: number, b: number) => {
  return Math.abs(a - b) < 0.001;
};
