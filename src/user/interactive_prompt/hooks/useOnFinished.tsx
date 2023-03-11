import { useEffect } from 'react';
import { InteractivePrompt } from '../models/InteractivePrompt';
import { PromptTime, waitUntilUsingPromptTimeCancelable } from './usePromptTime';

/**
 * Calls the onFinished callback when the prompt time reaches or exceeds the
 * prompt duration
 *
 * @param prompt The interactive prompt
 * @param promptTime The prompt time clock
 * @param onFinished The callback to call when the prompt is finished
 */
export const useOnFinished = (
  prompt: InteractivePrompt,
  promptTime: PromptTime,
  onFinished: () => void
): void => {
  useEffect(() => {
    const promptDurationMs = prompt.durationSeconds * 1000;
    if (promptTime.time.current >= promptDurationMs) {
      onFinished();
      return;
    }

    const promise = waitUntilUsingPromptTimeCancelable(
      promptTime,
      (event) => event.current >= promptDurationMs
    );
    promise.promise
      .then(() => {
        onFinished();
      })
      .catch(() => {});

    return () => promise.cancel();
  }, [promptTime, prompt, onFinished]);
};
