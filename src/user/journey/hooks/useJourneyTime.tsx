import { MutableRefObject, useEffect, useRef, useState } from 'react';

/**
 * The state held by journey time. This is a continuously updated value
 * that moves forward as time moves forward, but to avoid excessive
 * rerenders, the actual time is exposed as a ref with a callback list
 * that is called whenever the time changes.
 */
export type JourneyTime = {
  /**
   * The ref to the current time, in milliseconds. This is a mutable ref so that
   * it can be updated without causing a rerender. You cannot add this as a
   * dependency to hooks - but you can convert it to a less granular value and
   * use that as a dependency using the onTimeChanged hook
   */
  time: MutableRefObject<DOMHighResTimeStamp>;

  /**
   * A list of callbacks to call whenever the time changes. This is
   * useful for converting the time to a less granular value and using
   * that as a dependency in a hook. This can be done conveniently using
   * useCoarseTime exposed in this file.
   *
   * Providing the old time as well is done to allow for more efficient
   * hooks. See useCoarseTime for an example for how it avoids a dependency
   *
   * New entries MUST be appended to the end of the array. Callees may
   * use this fact to speed up removal by only looking from their insertion
   * index backward, rather than the full list.
   */
  onTimeChanged: MutableRefObject<
    ((lastTime: DOMHighResTimeStamp, newTime: DOMHighResTimeStamp) => void)[]
  >;

  /**
   * If the time is currently paused, i.e., not moving forward
   */
  paused: boolean;

  /**
   * Updates the paused state of the time.
   * @param paused Whether the time is paused or not. If true, the time will not move forward.
   */
  setPaused: (paused: boolean) => void;
};

/**
 * Produces a journey time clock which can be used to sync up various components
 * for a journey, as well as with the server. This is a continuously updated
 * value which is not suitable as a dependency for hooks, but can be converted
 * to a less granular value using the onTimeChanged callback, typically via
 * useCoarseTime.
 *
 * @param initialTime The initial time to use
 * @returns The journey time state, automatically updated
 */
export const useJourneyTime = (
  initialTime: DOMHighResTimeStamp,
  initiallyPaused?: boolean | undefined
): JourneyTime => {
  const time = useRef<number>(initialTime);
  const onTimeChanged = useRef<
    ((lastTime: DOMHighResTimeStamp, newTime: DOMHighResTimeStamp) => void)[]
  >([]);
  const [paused, setPaused] = useState<boolean>(initiallyPaused ?? false);

  useEffect(() => {
    if (paused) {
      return;
    }

    let lastTime = time.current;
    let lastAnimTime: DOMHighResTimeStamp | null = null;
    let mounted = true;

    const onFrame = (animTime: DOMHighResTimeStamp) => {
      if (!mounted) {
        return;
      }

      if (lastAnimTime === null) {
        lastAnimTime = animTime;
        requestAnimationFrame(onFrame);
        return;
      }

      const delta = animTime - lastAnimTime;
      time.current += delta;

      const cpListeners = onTimeChanged.current.slice();
      for (const listener of cpListeners) {
        listener(lastTime, time.current);
      }

      lastTime = time.current;

      lastAnimTime = animTime;
      requestAnimationFrame(onFrame);
    };

    requestAnimationFrame(onFrame);

    return () => {
      mounted = false;
    };
  }, [paused]);

  return {
    time,
    onTimeChanged,
    paused,
    setPaused,
  };
};

/**
 * Returns a standard state object for a journey time, which can be used as a dependency.
 * This coarsens the time into a number that is updated every granularity milliseconds,
 * which is useful for avoiding excessive rerenders.
 *
 * @param time The journey time to use
 * @param granularity The granularity of the time in milliseconds
 * @param offset An offset to apply to the time in milliseconds prior to calculating the coarse time.
 *   For example, if the offset is 1000 and the granularity is 2000, then at 0 the coarse time will be 0,
 *   at 1000 it will be 1, at 2000 it will be 1, at 3000 it will be 2, etc, incrementing every 2 seconds.
 *   Typically 0.
 * @param clipToZero Whether to clip the coarse time to 0 if it is negative. Default false
 * @returns the coarsened time, updating only once every granularity milliseconds
 */
export const useCoarseTime = (
  time: JourneyTime,
  granularity: number,
  offset: number,
  clipToZero?: boolean | undefined
): number => {
  if (clipToZero === undefined) {
    clipToZero = false;
  }

  const [coarseTime, setCoarseTime] = useState<number>(() => {
    const trueCoarseTime = Math.floor((time.time.current + offset) / granularity);
    if (clipToZero) {
      return Math.max(trueCoarseTime, 0);
    }
    return trueCoarseTime;
  });

  useEffect(() => {
    const onTimeChanged = (lastTime: DOMHighResTimeStamp, newTime: DOMHighResTimeStamp) => {
      let oldCoarseTime = Math.floor((lastTime + offset) / granularity);
      let newCoarseTime = Math.floor((newTime + offset) / granularity);

      if (clipToZero) {
        oldCoarseTime = Math.max(oldCoarseTime, 0);
        newCoarseTime = Math.max(newCoarseTime, 0);
      }

      if (newCoarseTime !== oldCoarseTime) {
        setCoarseTime(newCoarseTime);
      }
    };
    time.onTimeChanged.current.push(onTimeChanged);
    return () => {
      const index = time.onTimeChanged.current.indexOf(onTimeChanged);
      if (index !== -1) {
        time.onTimeChanged.current.splice(index, 1);
      }
    };
  }, [clipToZero, granularity, offset, time.onTimeChanged]);

  return coarseTime;
};
