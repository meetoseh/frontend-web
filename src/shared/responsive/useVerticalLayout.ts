import { MutableRefObject, useRef } from 'react';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../lib/Callbacks';
import {
  ComputedVerticalLayout,
  VerticalLayout,
  applyVerticalLayout,
  prepareVerticalLayout,
  updateForNewMinHeights,
} from './VerticalLayout';
import { useMinHeights } from './useMinHeights';
import { useMappedValuesWithCallbacks } from '../hooks/useMappedValuesWithCallbacks';
import { useMappedValueWithCallbacks } from '../hooks/useMappedValueWithCallbacks';
import { useValueWithCallbacksEffect } from '../hooks/useValueWithCallbacksEffect';
import { setVWC } from '../lib/setVWC';
import { ResponsiveRefs } from './useResponsiveRefs';

/**
 * Given a base layout rendering with the given amount of available height,
 * and refs to the actual components, returns the computed vertical layout
 * to use.
 *
 * This is analagous to a simple prepareVerticalLayout unless the minimum
 * height of the components differs from whats expected due to e.g. client-side
 * injected CSS, a simple mistake, etc.
 *
 * @param config The base vertical layout
 * @param height The available height
 * @param refs The refs to the components
 * @returns The computed vertical layout to use, the applied heights, and whether or
 *   not vertical scaling is required
 */
export const useVerticalLayout = <K extends string>(
  config: ValueWithCallbacks<VerticalLayout<K>>,
  height: ValueWithCallbacks<number>,
  refs: ResponsiveRefs<K>
): [
  ValueWithCallbacks<ComputedVerticalLayout<K>>,
  ValueWithCallbacks<Record<K, number>>,
  ValueWithCallbacks<boolean>
] => {
  const preparedBase = useMappedValueWithCallbacks(config, prepareVerticalLayout);

  const keysRef = useRef<K[]>(null) as MutableRefObject<K[]>;
  if (keysRef.current === null) {
    keysRef.current = Object.keys(config.get()) as K[];
    // we dont check keys in development since it'll be checked by useMinHeights
  }

  const requestedRef = useRef<Record<K, WritableValueWithCallbacks<number>>>(
    null
  ) as MutableRefObject<Record<K, WritableValueWithCallbacks<number>>>;
  if (requestedRef.current === null) {
    const appliedBase = applyVerticalLayout(
      preparedBase.get(),
      Math.max(preparedBase.get().requiredHeight, height.get())
    );
    requestedRef.current = {} as Record<K, WritableValueWithCallbacks<number>>;
    for (const key of keysRef.current) {
      requestedRef.current[key] = createWritableValueWithCallbacks(appliedBase[key]);
    }
  }

  const minHeights = useMinHeights(config, requestedRef.current, refs);
  const updatedConfig = useMappedValuesWithCallbacks(
    [...keysRef.current.map((key) => minHeights[key]), config],
    () => {
      const keys = keysRef.current;
      const cfg = config.get();
      const newMinHeights = {} as Record<K, number>;
      let foundChanged = false;

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const newMinHeight = minHeights[key].get();
        newMinHeights[key] = newMinHeight;
        foundChanged ||= newMinHeight !== cfg[key].minHeight;
      }

      if (!foundChanged) {
        return cfg;
      }

      return updateForNewMinHeights(cfg, newMinHeights);
    }
  );

  const prepared = useMappedValueWithCallbacks(updatedConfig, prepareVerticalLayout);
  const scrollingRequired = useMappedValuesWithCallbacks(
    [prepared, height],
    () => height.get() < prepared.get().requiredHeight
  );
  const applied = useMappedValuesWithCallbacks(
    [scrollingRequired, preparedBase, prepared, height],
    () =>
      applyVerticalLayout(
        scrollingRequired.get() ? preparedBase.get() : prepared.get(),
        scrollingRequired.get() ? preparedBase.get().requiredHeight : height.get()
      ),
    {
      outputEqualityFn: (a, b) =>
        a === b || keysRef.current.every((key) => Math.abs(a[key] - b[key]) < 0.1),
    }
  );

  useValueWithCallbacksEffect(applied, (newRequestedHeights) => {
    for (const key of keysRef.current) {
      setVWC(requestedRef.current[key], newRequestedHeights[key]);
    }
    return undefined;
  });

  return [prepared, applied, scrollingRequired];
};
