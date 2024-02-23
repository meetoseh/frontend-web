import { ReactElement, useCallback, useRef } from 'react';
import { ValueWithCallbacks } from '../lib/Callbacks';
import { OsehTranscriptPhrase } from './OsehTranscript';
import { useMappedValuesWithCallbacks } from '../hooks/useMappedValuesWithCallbacks';
import { fadeTimeSeconds, holdLateSeconds } from './useCurrentTranscriptPhrases';
import { useAnimatedValueWithCallbacks } from '../anim/useAnimatedValueWithCallbacks';
import { BezierAnimator } from '../anim/AnimationLoop';
import { ease } from '../lib/Bezier';
import { useValueWithCallbacksEffect } from '../hooks/useValueWithCallbacksEffect';
import { setVWC } from '../lib/setVWC';
import styles from './TranscriptPhrase.module.css';

/**
 * Renders a single transcript phrase, fading it in and out as it becomes
 * relevant and irrelevant.
 *
 * Expected to be used with `useCurrentTranscriptPhrases`, typically
 * via `TranscriptContainer`
 */
export const TranscriptPhrase = (
  props: React.PropsWithChildren<{
    /** Current time in seconds from the start of the content */
    currentTime: ValueWithCallbacks<number>;
    phrase: OsehTranscriptPhrase;
  }>
): ReactElement => {
  const ele = useRef<HTMLDivElement>(null);
  const opacityTarget = useMappedValuesWithCallbacks(
    [props.currentTime],
    useCallback(() => {
      const progressSeconds = props.currentTime.get();
      const timeUntilEnd = props.phrase.endsAt + holdLateSeconds - progressSeconds;
      return timeUntilEnd < fadeTimeSeconds ? 0 : 1;
    }, [props.phrase, props.currentTime])
  );

  const target = useAnimatedValueWithCallbacks<{ opacity: number }>(
    () => ({ opacity: 0 }),
    () => [
      new BezierAnimator(
        ease,
        fadeTimeSeconds * 1000,
        (p) => p.opacity,
        (p, v) => (p.opacity = v)
      ),
    ],
    (val) => {
      if (ele.current !== null) {
        ele.current.style.opacity = val.opacity.toString();
      }
    }
  );

  useValueWithCallbacksEffect(
    opacityTarget,
    useCallback(
      (opacity) => {
        setVWC(target, { opacity }, (a, b) => a.opacity === b.opacity);
        return undefined;
      },
      [target]
    )
  );

  return (
    <div className={styles.container} ref={ele}>
      {props.children}
    </div>
  );
};
