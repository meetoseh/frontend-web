import { MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
import { Callbacks } from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';

export type PromptTimeEvent = {
  /**
   * The time before the change.
   */
  old: DOMHighResTimeStamp;

  /**
   * The time after the change.
   */
  current: DOMHighResTimeStamp;
};
/**
 * The state held to keep track of the current time relative to the start of the
 * prompt. This time is updated every frame, which is too often for react renders,
 * and hence is stored as a mutable ref object for the current value as well as
 * callbacks to be called when the time changes. Convenience functions are available
 * in this module for coarsening the time and using it in state.
 */
export type PromptTime = {
  /**
   * The current time in milliseconds since the start of the prompt.
   * In some contexts it can be useful to start this value negative,
   * in which case while it's negative its absolute value is milliseconds
   * until the prompt starts.
   */
  time: MutableRefObject<DOMHighResTimeStamp>;

  /**
   * Contains the functions to call when the time changes. This is called
   * approximately once per frame while not paused.
   */
  onTimeChanged: MutableRefObject<Callbacks<PromptTimeEvent>>;

  /**
   * True if the time is currently paused, i.e., not moving forward.
   * False if the time is moving forward.
   */
  paused: boolean;
};

/**
 * Starts a prompt time clock with a given initial time. The prompt time is updated
 * every frame and does not trigger a rerender. The returned value is stable except
 * if the paused state changes, in which case a new object is returned.
 */
export const usePromptTime = (initialTime: number, paused: boolean): PromptTime => {
  const now = useRef<number>() as MutableRefObject<number>;
  const onTimeChanged = useRef<Callbacks<PromptTimeEvent>>() as MutableRefObject<
    Callbacks<PromptTimeEvent>
  >;

  if (now.current === undefined) {
    now.current = initialTime;
  }

  if (onTimeChanged.current === undefined) {
    onTimeChanged.current = new Callbacks();
  }

  useEffect(() => {
    if (paused) {
      return;
    }

    let lastFrameAt: DOMHighResTimeStamp | null = null;
    let active = true;
    requestAnimationFrame(onFrame);
    return () => {
      active = false;
    };

    function onFrame(frameAt: DOMHighResTimeStamp) {
      if (!active) {
        return;
      }

      if (lastFrameAt === null) {
        lastFrameAt = frameAt;
        requestAnimationFrame(onFrame);
        return;
      }

      const delta = frameAt - lastFrameAt;
      lastFrameAt = frameAt;
      const prevTime = now.current;
      const newTime = now.current + delta;
      now.current = newTime;
      onTimeChanged.current.call({ old: prevTime, current: newTime });
      requestAnimationFrame(onFrame);
    }
  }, [paused]);

  return useMemo(
    () => ({
      time: now,
      onTimeChanged,
      paused,
    }),
    [paused, now, onTimeChanged]
  );
};

/**
 * Returns a new number which is a coarsened version of the given prompt time. Specifically,
 * this computes (promptTime + offset) / granularity, rounded down to the nearest integer,
 * and causing react to rerender if the result changes.
 *
 * @param promptTime The prompt time to coarsen
 * @param offset The offset to add to the prompt time before dividing by the granularity
 * @param granularity The granularity to divide by
 */
export const useCoarsenedPromptTime = (
  promptTime: PromptTime,
  offset: number,
  granularity: number
): number => {
  const [coarsened, setCoarsened] = useState<number>(() =>
    Math.floor((promptTime.time.current + offset) / granularity)
  );

  useEffect(() => {
    let curValue = Math.floor((promptTime.time.current + offset) / granularity);
    const callback = (event: PromptTimeEvent) => {
      const newValue = Math.floor((event.current + offset) / granularity);

      if (newValue !== curValue) {
        curValue = newValue;
        setCoarsened(newValue);
      }
    };

    promptTime.onTimeChanged.current.add(callback);

    return () => {
      promptTime.onTimeChanged.current.remove(callback);
    };
  }, [promptTime, offset, granularity]);

  return coarsened;
};

/**
 * Waits until the given condition is true, checking once every time the prompt time
 * changes. The condition is passed the current prompt time event.
 *
 * @param promptTime The prompt time to use
 * @param condition The condition to wait for
 * @returns A promise that resolves when the condition is true
 */
export const waitUntilUsingPromptTime = (
  promptTime: PromptTime,
  condition: (event: PromptTimeEvent) => boolean
): Promise<void> => {
  return new Promise((resolve) => {
    const callback = (event: PromptTimeEvent) => {
      if (condition(event)) {
        promptTime.onTimeChanged.current.remove(callback);
        resolve();
      }
    };

    promptTime.onTimeChanged.current.add(callback);
  });
};

/**
 * Equivalent to waitUntilUsingPromptTime, but returns a CancelablePromise instead
 * of a regular promise.
 * @param promptTime The prompt time to use
 * @param condition The condition to wait for
 * @returns A cancelable promise that resolves when the condition is true
 */
export const waitUntilUsingPromptTimeCancelable = (
  promptTime: PromptTime,
  condition: (event: PromptTimeEvent) => boolean
): CancelablePromise<void> => {
  let active = true;
  let canceler: () => void = () => {
    active = false;
  };
  let done = false;
  const promise = new Promise<void>((resolve, reject) => {
    if (!active) {
      reject();
      return;
    }

    const callback = (event: PromptTimeEvent) => {
      if (!active) {
        return;
      }

      if (condition(event)) {
        active = false;
        done = true;
        promptTime.onTimeChanged.current.remove(callback);
        resolve();
      }
    };
    canceler = () => {
      if (!active) {
        return;
      }
      active = false;
      done = true;
      promptTime.onTimeChanged.current.remove(callback);
      reject();
    };
    promptTime.onTimeChanged.current.add(callback);
  });
  return {
    promise,
    cancel: () => canceler(),
    done: () => done,
  };
};
