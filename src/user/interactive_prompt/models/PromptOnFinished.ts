import { PromptTime } from '../hooks/usePromptTime';

/**
 * The typical onFinished handler for interactive prompts.
 */
export type PromptOnFinished<T> = (
  privileged: boolean,
  reason: 'time' | 'skip',
  time: PromptTime,
  selection: T
) => void;
