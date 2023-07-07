import { ReactElement, useEffect, useRef } from 'react';
import { PromptTime } from '../hooks/usePromptTime';
import { InteractivePrompt } from '../models/InteractivePrompt';
import styles from './CountdownText.module.css';
import { ValueWithCallbacks } from '../../../shared/lib/Callbacks';

export type CountdownTextConfig = {
  /**
   * The title text to display above the countdown
   */
  titleText: string;
};

type CountdownTextProps = CountdownTextConfig & {
  /**
   * The prompt time to show a countdown for
   */
  promptTime: ValueWithCallbacks<PromptTime>;

  /**
   * The prompt to show a countdown for
   */
  prompt: InteractivePrompt;
};

/**
 * Returns an element containing the countdown text for the given prompt time.
 * This does not trigger state updates in order to update the countdown text.
 */
export const CountdownText = ({
  promptTime,
  prompt,
  titleText,
}: CountdownTextProps): ReactElement => {
  const textElement = useRef<HTMLDivElement>(null);

  const durationMs = prompt.durationSeconds * 1000;
  useEffect(() => {
    let curText = '';
    promptTime.callbacks.add(callback);

    return () => {
      promptTime.callbacks.remove(callback);
    };

    function callback() {
      const newText = formatProgressAsCountdown(durationMs, promptTime.get().time);
      if (curText !== newText && textElement.current) {
        textElement.current.textContent = newText;
        curText = newText;
      }
    }
  }, [durationMs, promptTime]);

  return (
    <div className={styles.container}>
      <div className={styles.title}>{titleText}</div>
      <div className={styles.countdown} ref={textElement}>
        {formatProgressAsCountdown(durationMs, promptTime.get().time)}
      </div>
    </div>
  );
};

const formatProgressAsCountdown = (totalMs: number, progressMs: number): string => {
  if (progressMs <= 0) {
    return formatMs(totalMs);
  }

  if (progressMs >= totalMs) {
    return '0';
  }

  return formatMs(totalMs - progressMs);
};

const formatMs = (ms: number): string => {
  return Math.ceil(ms / 1000).toString();
};
