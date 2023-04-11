import { useEffect, useState } from 'react';

/**
 * A basic hook to get the window size with a debounced resize listener
 *
 * @param forcedSize if specified, returned instead of the real window size.
 *   Convenient when you want to render a component that uses this hook at
 *   a specific size, such as in an admin preview.
 */
export const useWindowSize = (forcedSize?: {
  width: number;
  height: number;
}): { width: number; height: number } => {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    let active = true;

    const onDebounced = () => {
      if (!active) {
        return;
      }

      timeout = null;
      setWindowSize((oldWindowSize) => {
        // on ios when you swipe down the window size gets slightly larger
        // for a short time. We want to not cause useEffects to trigger
        // when this happens

        if (
          window.innerWidth === oldWindowSize.width &&
          window.innerHeight === oldWindowSize.height
        ) {
          return oldWindowSize;
        }
        return {
          width: window.innerWidth,
          height: window.innerHeight,
        };
      });
    };

    const onResize = () => {
      if (!active) {
        return;
      }

      if (timeout !== null) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(onDebounced, 100);
    };

    window.addEventListener('resize', onResize);

    return () => {
      active = false;
      window.removeEventListener('resize', onResize);

      if (timeout !== null) {
        clearTimeout(timeout);
      }
    };
  }, []);

  return forcedSize ?? windowSize;
};
