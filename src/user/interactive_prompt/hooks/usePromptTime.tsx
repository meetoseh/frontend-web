import { useEffect } from 'react';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../../../shared/anim/VariableStrategyProps';

export type UsePromptTimeProps = {
  /**
   * The time to start the clock at, in milliseconds. Changing this
   * value doesn't affect anything once the hook was initialized.
   */
  initialTime: number;

  /**
   * True if the clock is currently paused, false if it's running.
   */
  paused: boolean;
};

export type PromptTime = {
  /**
   * The current time in milliseconds since the start of the prompt.
   * In some contexts it can be useful to start this value negative,
   * in which case while it's negative its absolute value is milliseconds
   * until the prompt starts.
   *
   * Since this number can get large, whereas frame times are usually
   * quite small, to improve accuracy we double the space we use to
   * store the time. This usually doesn't matter when using the time,
   * but the small bits of the timestamp are stored in timeCompensation,
   * and are computed via the Kahan summation algorith.
   */
  time: DOMHighResTimeStamp;

  /**
   * Stores the low part of time. Has the strange property that
   * timeCompensation>0, but time + timeCompensation === time
   * due to the way floating point numbers work.
   */
  timeCompensation: number;

  /**
   * True if the time is currently paused, i.e., not moving forward.
   * False if the time is moving forward.
   */
  paused: boolean;
};

/**
 * This hook acts as the main driver of action for the interactive prompt.
 * When unpaused, increments the time in real time once per frame.
 */
export const usePromptTime = (
  propsVariableStrategy: VariableStrategyProps<UsePromptTimeProps>
): ValueWithCallbacks<PromptTime> => {
  const propsVWC = useVariableStrategyPropsAsValueWithCallbacks(propsVariableStrategy);
  const result = useWritableValueWithCallbacks<PromptTime>(() => ({
    time: propsVWC.get().initialTime,
    timeCompensation: 0,
    paused: propsVWC.get().paused,
  }));

  useEffect(() => {
    let mounted = true;
    let canceler: (() => void) | null = null;
    propsVWC.callbacks.add(handlePropsChanged);
    handlePropsChanged();
    return () => {
      if (mounted) {
        mounted = false;
        propsVWC.callbacks.remove(handlePropsChanged);
        canceler?.();
        canceler = null;
      }
    };

    function handleProps(props: UsePromptTimeProps): (() => void) | null {
      if (result.get().paused !== props.paused) {
        result.get().paused = props.paused;
        result.callbacks.call(undefined);
      }

      if (props.paused) {
        return null;
      }

      let active = true;
      requestAnimationFrame(onFirstFrame.bind(undefined, performance.now()));
      return () => {
        active = false;
      };

      function onFrame(lastFrameAt: DOMHighResTimeStamp, currentFrameAt: DOMHighResTimeStamp) {
        if (!active) {
          return;
        }

        handleElapsedTime(currentFrameAt - lastFrameAt);
        requestAnimationFrame(onFrame.bind(undefined, currentFrameAt));
      }

      function onFirstFrame(startTime: number, currentFrameAt: DOMHighResTimeStamp) {
        if (!active) {
          return;
        }

        handleElapsedTime(performance.now() - startTime);
        requestAnimationFrame(onFrame.bind(undefined, currentFrameAt));
      }

      function handleElapsedTime(elapsedTime: number) {
        const val = result.get();

        // variable names chosen to match the pseudocode on wikipedia,
        // which makes verifying this is correct easier
        const sum = val.time;
        const c = val.timeCompensation;
        const y = elapsedTime - c;
        const t = sum + y;

        val.timeCompensation = t - sum - y;
        val.time = t;

        result.callbacks.call(undefined);
      }
    }

    function handlePropsChanged() {
      if (!mounted) {
        return;
      }

      canceler?.();
      canceler = handleProps(propsVWC.get());
    }
  }, [propsVWC, result]);

  return result;
};
