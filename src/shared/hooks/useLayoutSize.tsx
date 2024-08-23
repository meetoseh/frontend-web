import { ReactElement, useEffect } from 'react';
import {
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
  ValueWithCallbacks,
  WritableValueWithCallbacks,
} from '../lib/Callbacks';
import { createValueWithCallbacksEffect } from './createValueWithCallbacksEffect';
import { setVWC } from '../lib/setVWC';
import { useValueWithCallbacksEffect } from './useValueWithCallbacksEffect';

const getClientSize = (element: HTMLElement) => ({
  width: element.clientWidth,
  height: element.clientHeight,
});

type LayoutSizeOpts<T extends HTMLElement> = {
  /** If specified, used to extract the size of the element. Otherwise, clientWidth and clientHeight are used. */
  getSize?: (element: T) => { width: number; height: number };
};

/**
 * Determines the layout size of the given element. This is intended to somewhat
 * replicate the onLayout callback in react native, and thus does not have a react
 * native equivalent by the same name.
 *
 * Uses ResizeObserver if available, otherwise only rechecks the ref size if the
 * ref changes or the window resizes. Does not debounce.
 *
 * @param ref The html element ref to watch
 * @returns A tuple of the layout size of the element, or null if the element is not
 *   mounted, and a function to cleanup the effect
 */
export const mapRefToLayoutSize = <T extends HTMLElement>(
  ref: ValueWithCallbacks<T | null>,
  opts?: LayoutSizeOpts<T>
): [ValueWithCallbacks<{ width: number; height: number } | null>, () => void] => {
  const sizeVWC = createWritableValueWithCallbacks<{ width: number; height: number } | null>(null);
  const getSize = opts?.getSize ?? getClientSize;

  const cleanupEffect = createValueWithCallbacksEffect(ref, (elementRaw) => {
    if (elementRaw === null) {
      setVWC(sizeVWC, null);
      return undefined;
    }
    const element = elementRaw;

    if (window.ResizeObserver) {
      return handleWithResizeObserver();
    }

    return handleWithWindowResize();

    function handleWithResizeObserver() {
      let active = true;
      const observer = new ResizeObserver(() => {
        if (active) {
          setVWC(sizeVWC, getSize(element));
        }
      });
      observer.observe(element);
      return () => {
        active = false;
        observer.disconnect();
      };
    }

    function handleWithWindowResize() {
      let active = true;
      const handleResize = () => {
        if (active) {
          setVWC(sizeVWC, getSize(element));
        }
      };

      window.addEventListener('resize', handleResize);
      handleResize();
      return () => {
        active = false;
        window.removeEventListener('resize', handleResize);
      };
    }
  });

  return [sizeVWC, cleanupEffect];
};

/** A hook-like equivalent to mapRefToLayoutSize */
export const useLayoutSize = <T extends HTMLElement>(
  ref: ValueWithCallbacks<T | null>,
  opts?: LayoutSizeOpts<T>
): ValueWithCallbacks<{ width: number; height: number } | null> => {
  const sizeVWC = useWritableValueWithCallbacks<{ width: number; height: number } | null>(
    () => null
  );

  useEffect(() => {
    const [underlying, cleanupUnderlying] = mapRefToLayoutSize(ref, opts);
    const cleanupAttacher = createValueWithCallbacksEffect(underlying, (size) => {
      setVWC(sizeVWC, size, (a, b) =>
        a === null || b === null ? a === b : a.width === b.width && a.height === b.height
      );
      return undefined;
    });

    return () => {
      cleanupAttacher();
      cleanupUnderlying();
    };
  }, [ref, sizeVWC]);

  return sizeVWC;
};

/**
 * Allows getting an onLayout function that is somewhat similar to the react native
 * version.
 *
 * Usage:
 *
 * ```tsx
 * <OnLayoutAdapter component={(ref) => <div ref={(r) => setVWC(ref, r)} />} onLayout={(e) => {
 *   const width = e?.nativeEvent?.layout?.width;
 *   if (width !== undefined && width !== null && !isNaN(width) && width >= 0) {
 *     // logic here
 *   }
 * }} />
 * ```
 */
export const OnLayoutAdapter = <T extends HTMLElement>({
  component,
  onLayout,
  opts,
}: {
  component: (ref: WritableValueWithCallbacks<T | null>) => ReactElement;
  onLayout: (
    event:
      | { nativeEvent?: { layout?: { width?: number | null; height?: number | null } } }
      | null
      | undefined
  ) => void;
  opts?: LayoutSizeOpts<T>;
}) => {
  const ref = useWritableValueWithCallbacks<T | null>(() => null);
  const sizeVWC = useLayoutSize(ref, opts);

  useValueWithCallbacksEffect(sizeVWC, (size) => {
    if (size === null) {
      onLayout(null);
    } else {
      onLayout({ nativeEvent: { layout: size } });
    }
    return undefined;
  });

  return component(ref);
};
