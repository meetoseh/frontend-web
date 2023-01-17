import { useEffect, useState } from 'react';

/**
 * A basic hook to get the window size with a debounced resize listener
 */
export const useWindowSize = (): { width: number; height: number } => {
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
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
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

  return windowSize;
};
