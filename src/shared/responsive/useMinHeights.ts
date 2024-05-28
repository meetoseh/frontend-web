import { MutableRefObject, useRef } from 'react';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../lib/Callbacks';
import { VerticalLayout } from './VerticalLayout';
import { useValuesWithCallbacksEffect } from '../hooks/useValuesWithCallbacksEffect';
import { setVWC } from '../lib/setVWC';
import { ResponsiveRefs } from './useResponsiveRefs';
import { largestPhysicalPerLogical } from '../images/DisplayRatioHelper';

const isDevelopment = process.env.REACT_APP_ENVIRONMENT === 'dev';

/**
 * This is a purely informational hook function - it does not alter
 * the refs.
 *
 * Given that we are requesting the given heights (via the min-height property,
 * typically, or something functionally similar), this hook identifies any
 * components that are rendering at a greater height than requested, which
 * implies they have a larger minimum height than we thought, possibly due to
 * client-injected CSS, and assigns that as the new minimum height for that
 * component.
 *
 * Initializes the minimum heights using the given base vertical layout.
 *
 * This will error if the keys change between renders in development,
 * and will behave unpredictably in production if the keys change.
 */
export const useMinHeights = <K extends string>(
  base: ValueWithCallbacks<VerticalLayout<K>>,
  requested: Record<K, ValueWithCallbacks<number>>,
  refs: ResponsiveRefs<K>
): Record<K, ValueWithCallbacks<number>> => {
  const keysRef = useRef<K[]>(null) as MutableRefObject<K[]>;
  if (keysRef.current === null) {
    keysRef.current = Object.keys(base.get()) as K[];
  } else if (process.env.REACT_APP_ENVIRONMENT === 'dev') {
    const oldKeysSet = new Set(keysRef.current);
    const newKeysSet = new Set(Object.keys(base.get()) as K[]);
    if (oldKeysSet.size !== newKeysSet.size) {
      throw new Error('useMinHeights: keys changed between renders. This is not allowed.');
    }
    for (const key of keysRef.current) {
      if (!newKeysSet.has(key)) {
        throw new Error('useMinHeights: keys changed between renders. This is not allowed.');
      }
    }
  }

  const minRelevantPixelDifference = 1 / largestPhysicalPerLogical;

  const minHeights = useRef<Record<K, WritableValueWithCallbacks<number>>>(
    null
  ) as MutableRefObject<Record<K, WritableValueWithCallbacks<number>>>;
  if (minHeights.current === null) {
    const newValue = {} as Record<K, WritableValueWithCallbacks<number>>;
    const baseInitial = base.get();
    for (const key in baseInitial) {
      newValue[key] = createWritableValueWithCallbacks(baseInitial[key].minHeight);
    }
    minHeights.current = newValue;
  }

  keysRef.current.forEach((key) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useValuesWithCallbacksEffect([requested[key], refs[key].size], () => {
      let timeout: NodeJS.Timeout | null = setTimeout(onDebounce, 100);
      return () => {
        if (timeout !== null) {
          clearTimeout(timeout);
          timeout = null;
        }
      };

      function onDebounce() {
        if (timeout === null) {
          return;
        }

        timeout = null;
        const requestedHeight = requested[key].get();
        const actualSizeRaw = refs[key].size.get();
        if (actualSizeRaw === null) {
          return;
        }

        const newHeight = actualSizeRaw.height;
        if (Math.abs(newHeight - requestedHeight) < minRelevantPixelDifference) {
          return;
        }

        if (isDevelopment) {
          console.log(
            `useMinHeights detected ${key} is rendering at ${newHeight}, even though we requested ${requestedHeight}`
          );
        }

        if (newHeight <= requestedHeight) {
          return;
        }

        const expectedMinHeight = minHeights.current[key].get();
        if (newHeight <= expectedMinHeight) {
          return;
        }

        if (isDevelopment) {
          console.log(`useMinHeights detected ${key} actually has min height ${newHeight}`);
        }

        setVWC(minHeights.current[key], newHeight);
        return;
      }
    });
  });

  return minHeights.current;
};
