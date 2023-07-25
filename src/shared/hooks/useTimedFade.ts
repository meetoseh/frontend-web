import { useEffect } from 'react';
import { BezierAnimation, animIsComplete, calculateAnimValue } from '../lib/BezierAnimation';
import { ease } from '../lib/Bezier';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import { setVWC } from '../lib/setVWC';

/**
 * Creates a value with callbacks whose current value represents the
 * opacity (0-1) that a container should have if it's desired that
 * the container be faded in when this hook is mounted and faded out
 * completely at the given time.
 *
 * @param until The time at which the container should be faded out
 * @param duration How long the fade in / out should take
 * @return A value with callbacks that represents the opacity of the container
 */
export const useTimedFade = (until: number, duration: number = 350): ValueWithCallbacks<number> => {
  const opacity = useWritableValueWithCallbacks(() => 0);
  useEffect(() => {
    let step: 'in' | 'out' = 'in';
    let opacityAnim: BezierAnimation = {
      from: 0,
      to: 1,
      startedAt: null,
      ease,
      duration,
    };

    let active = true;
    let timeout: NodeJS.Timeout | null = null;
    requestAnimationFrame(onFrame);
    return () => {
      active = false;
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    function onFrame(now: DOMHighResTimeStamp) {
      if (!active) {
        return;
      }

      if (animIsComplete(opacityAnim, now)) {
        if (step === 'in') {
          const epochNow = Date.now();
          const fadeOutAt = until - duration;
          step = 'out';
          opacityAnim = {
            from: 1,
            to: 0,
            startedAt: null,
            ease,
            duration,
          };
          if (epochNow < fadeOutAt) {
            timeout = setTimeout(() => {
              timeout = null;
              requestAnimationFrame(onFrame);
            }, fadeOutAt - epochNow);
            setVWC(opacity, 1);
            return;
          }
        } else {
          return;
        }
      }

      setVWC(opacity, calculateAnimValue(opacityAnim, now));
      requestAnimationFrame(onFrame);
    }
  }, [opacity, until, duration]);
  return opacity;
};
