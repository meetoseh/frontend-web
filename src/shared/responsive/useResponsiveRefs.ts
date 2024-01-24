import {
  Callbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../lib/Callbacks';
import { MutableRefObject, useCallback, useRef } from 'react';
import { setVWC } from '../lib/setVWC';
import { useValueWithCallbacksEffect } from '../hooks/useValueWithCallbacksEffect';

/**
 * Describes a reference to a view so that it can be used for useMinHeights.
 *
 * On the web this is relatively straightforward, but in native we need to
 * handle the oddities of measure(), onLayout(), and collapsable, and the
 * differences between ios/android. Notably, measure() doesn't work unless
 * onLayout is set.
 */
export type ResponsiveRef = {
  /**
   * The actual view, or null if unmounted
   */
  ref: WritableValueWithCallbacks<HTMLElement | null>;

  /**
   * The size of this element the last time it was mounted, if it has
   * ever been mounted, otherwise null
   */
  size: WritableValueWithCallbacks<{ width: number; height: number } | null>;
};

export type ResponsiveRefs<K extends string> = { [key in K]: ResponsiveRef };

/**
 * Initializes responsive refs using the given keys. The keys are assumed
 * to never change.
 */
export const useResponsiveRefs = <K extends string>(keys: K[]): ResponsiveRefs<K> => {
  const resultRef = useRef<ResponsiveRefs<K>>(null) as MutableRefObject<ResponsiveRefs<K>>;
  if (resultRef.current === null) {
    resultRef.current = {} as ResponsiveRefs<K>;
    for (const key of keys) {
      resultRef.current[key] = {
        ref: createWritableValueWithCallbacks<HTMLElement | null>(null),
        size: createWritableValueWithCallbacks<{
          width: number;
          height: number;
        } | null>(null),
      };
    }
  }

  return resultRef.current;
};

/**
 * Manages setting the ref and size for a given key in a responsive refs,
 * returning the function to pass to ref for the html element.
 */
export const useSetRef = <K extends string, T extends HTMLElement>(
  key: K,
  refs: ResponsiveRefs<K>
): ((ref: T | null) => void) => {
  useRefToSizeEffect(key, refs);
  return useCallback(
    (ref: T | null) => {
      setVWC(refs[key].ref, ref);
    },
    [key, refs]
  );
};

/**
 * Similar to useSetRef, but for wrapped components that expect the
 * ref to be provided as a writable value with callbacks
 */
export const useRefVWC = <K extends string, T extends HTMLElement>(
  key: K,
  refs: ResponsiveRefs<K>
): WritableValueWithCallbacks<T | null> => {
  useRefToSizeEffect(key, refs);
  return refs[key].ref as WritableValueWithCallbacks<T | null>;
};

const useRefToSizeEffect = <K extends string>(key: K, refs: ResponsiveRefs<K>) => {
  useValueWithCallbacksEffect(refs[key].ref, (ref) => {
    if (ref === null) {
      return undefined;
    }

    const element = ref;
    const cancelers = new Callbacks<undefined>();
    let running = true;
    let debounceAnimFrameId: number | null = null;

    if (window.ResizeObserver) {
      const observer = new ResizeObserver(() => {
        if (!running) {
          observer.disconnect();
          return;
        }
        handlePossibleResize();
      });
      observer.observe(element);
      cancelers.add(() => observer.disconnect());
    } else {
      const onWindowResize = () => {
        if (!running) {
          window.removeEventListener('resize', onWindowResize);
          return;
        }

        handlePossibleResize();
      };
      window.addEventListener('resize', onWindowResize);
      cancelers.add(() => window.removeEventListener('resize', onWindowResize));
    }

    measure();
    return () => {
      running = false;
      if (debounceAnimFrameId !== null) {
        cancelAnimationFrame(debounceAnimFrameId);
        debounceAnimFrameId = null;
      }
      cancelers.call(undefined);
    };

    function handlePossibleResize() {
      if (debounceAnimFrameId !== null) {
        cancelAnimationFrame(debounceAnimFrameId);
      }
      debounceAnimFrameId = requestAnimationFrame(onDebounce);
    }

    function onDebounce() {
      debounceAnimFrameId = null;
      measure();
    }

    function measure() {
      if (!running) {
        return;
      }

      const bounds = element.getBoundingClientRect();
      setVWC(
        refs[key].size,
        { width: bounds.width, height: bounds.height },
        (a, b) =>
          a === b ||
          (a !== null &&
            b !== null &&
            Math.abs(a.width - b.width) < 1e-6 &&
            Math.abs(a.height - b.height) < 1e-6)
      );
    }
  });
};
