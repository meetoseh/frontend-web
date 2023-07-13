import { CSSProperties, RefObject, useEffect } from 'react';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import { useUnwrappedValueWithCallbacks } from './useUnwrappedValueWithCallbacks';

type FullHeightProps = {
  attribute?: 'height' | 'minHeight' | 'maxHeight';
  windowSizeVWC: ValueWithCallbacks<{ width: number; height: number }>;
};

/**
 * Adjusts the height of the element to match the height of the window. This is
 * useful because 100vh uses the outer height of the element on mobile because
 * safari insisted it work that way (
 * https://nicolas-hoizey.com/articles/2015/02/18/viewport-height-is-taller-than-the-visible-part-of-the-document-in-some-mobile-browsers/#february-23rd-update
 * )
 */
export const useFullHeight = ({
  element,
  attribute = 'height',
  windowSizeVWC,
}: FullHeightProps & { element: RefObject<HTMLElement> }): void => {
  useEffect(() => {
    windowSizeVWC.callbacks.add(updateElement);
    updateElement();
    return () => {
      windowSizeVWC.callbacks.remove(updateElement);
    };

    function updateElement() {
      if (element.current !== null && element.current !== undefined) {
        element.current.style[attribute] = `${windowSizeVWC.get().height}px`;
      }
    }
  }, [windowSizeVWC, element, attribute]);
};

/**
 * Gets the style to apply to an element to make it full height. This is
 * useful because 100vh uses the outer height of the element on mobile because
 * safari insisted it work that way.
 */
export const useFullHeightStyle = ({
  attribute = 'height',
  windowSizeVWC,
}: FullHeightProps): CSSProperties => {
  const resultVWC = useWritableValueWithCallbacks<CSSProperties>(() => ({
    [attribute]: `${windowSizeVWC.get().height}px`,
  }));

  // we dont map so that attribute changing recomputed
  useEffect(() => {
    resultVWC.callbacks.add(updateResult);
    updateResult();
    return () => {
      resultVWC.callbacks.remove(updateResult);
    };

    function updateResult() {
      const newHeight = `${windowSizeVWC.get().height}px`;
      if (resultVWC.get()[attribute] !== newHeight) {
        resultVWC.set({ [attribute]: newHeight });
        resultVWC.callbacks.call(undefined);
      }
    }
  }, [attribute, windowSizeVWC, resultVWC]);

  return useUnwrappedValueWithCallbacks(resultVWC);
};
