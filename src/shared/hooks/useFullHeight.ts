import { RefObject, useEffect } from 'react';
import { useWindowSize } from './useWindowSize';

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
}: {
  element: RefObject<HTMLElement>;
  attribute?: 'height' | 'minHeight' | 'maxHeight';
  windowSize?: { height: number } | undefined;
}): void => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const myWindowSize: { height: number } = windowSize ?? useWindowSize();

  useEffect(() => {
    if (element.current !== null && element.current !== undefined) {
      element.current.style[attribute] = `${myWindowSize.height}px`;
    }
  }, [myWindowSize, element, attribute]);
};
