import { CSSProperties, RefObject, useEffect, useMemo } from 'react';
import { useWindowSize } from './useWindowSize';

type FullHeightProps = {
  attribute?: 'height' | 'minHeight' | 'maxHeight';
  windowSize?: { height: number } | undefined;
};

/**
 * Adjusts the height of the element to match the height of the window. This is
 * useful because 100vh uses the outer height of the element on mobile because
 * safari insisted it work that way (
 * https://nicolas-hoizey.com/articles/2015/02/18/viewport-height-is-taller-than-the-visible-part-of-the-document-in-some-mobile-browsers/#february-23rd-update
 * )
 *
 * If window size is specified, it's used, otherwise it's taken as if by the
 * useWindowSize hook. It must either always be specified or never specified.
 */
export const useFullHeight = ({
  element,
  attribute = 'height',
  windowSize = undefined,
}: FullHeightProps & { element: RefObject<HTMLElement> }): void => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const myWindowSize: { height: number } = windowSize ?? useWindowSize();

  useEffect(() => {
    if (element.current !== null && element.current !== undefined) {
      element.current.style[attribute] = `${myWindowSize.height}px`;
    }
  }, [myWindowSize, element, attribute]);
};

/**
 * Gets the style to apply to an element to make it full height. This is
 * useful because 100vh uses the outer height of the element on mobile because
 * safari insisted it work that way.
 */
export const useFullHeightStyle = ({
  attribute = 'height',
  windowSize = undefined,
}: FullHeightProps): CSSProperties => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const myWindowSize: { height: number } = windowSize ?? useWindowSize();

  return useMemo(() => {
    return {
      [attribute]: `${myWindowSize.height}px`,
    };
  }, [attribute, myWindowSize.height]);
};
