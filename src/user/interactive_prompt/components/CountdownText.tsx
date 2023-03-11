import { ReactElement, useEffect, useRef } from 'react';
import { PromptTime, PromptTimeEvent } from '../hooks/usePromptTime';
import { InteractivePrompt } from '../models/InteractivePrompt';
import styles from './CountdownText.module.css';

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
  promptTime: PromptTime;

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
    promptTime.onTimeChanged.current.add(callback);

    return () => {
      promptTime.onTimeChanged.current.remove(callback);
    };

    function callback(event: PromptTimeEvent) {
      const newText = formatProgressAsCountdown(durationMs, event.current);
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
        {formatProgressAsCountdown(durationMs, promptTime.time.current)}
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
