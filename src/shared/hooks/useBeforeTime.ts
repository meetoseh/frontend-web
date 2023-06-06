import { useEffect, useState } from 'react';

/**
 * Yields true until the given time, then yields false. If the time
 * is undefined, yields false.
 *
 * @param time The time, or undefined to yield false.
 * @returns True until the given time, then false.
 */
export const useBeforeTime = (time?: number): boolean => {
  const [show, setShow] = useState(() => time !== undefined && Date.now() < time);

  useEffect(() => {
    if (time === undefined) {
      setShow(false);
      return;
    }

    const now = Date.now();
    if (now >= time) {
      setShow(false);
      return;
    }

    setShow(true);
    let timeout: NodeJS.Timeout | null = setTimeout(() => {
      timeout = null;
      setShow(false);
    }, time - now);
    return () => {
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    };
  }, [time]);

  return show;
};
