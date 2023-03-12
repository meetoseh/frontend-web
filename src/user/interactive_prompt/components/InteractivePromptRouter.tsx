import { ReactElement } from 'react';
import { ErrorBlock } from '../../../shared/forms/ErrorBlock';
import { InteractivePrompt } from '../models/InteractivePrompt';
import { CountdownTextConfig } from './CountdownText';
import { NumericPrompt } from './NumericPrompt';
import { WordPrompt } from './WordPrompt';

type InteractivePromptRouterProps = {
  /**
   * The prompt to display
   */
  prompt: InteractivePrompt;

  /**
   * Called when the user has finished the prompt
   */
  onFinished: () => void;

  /**
   * Called if the interactive prompt is a word prompt after the user selects
   * an option. This is commonly used for using an interactive prompt for
   * a settings page, which adds a lot of flashiness.
   *
   * @param response The value of the option the user selected.
   */
  onWordPromptResponse?: (response: string) => void;

  /**
   * If specified, a countdown is displayed with the given properties.
   */
  countdown?: CountdownTextConfig;

  /**
   * If specified, a subtitle is displayed in small text above
   * the prompt, e.g., 'Class Poll'
   */
  subtitle?: string;

  /**
   * If set to true, the prompt time will not be updated.
   */
  paused?: boolean;
};

/**
 * Renders an arbitrary interactive prompt and calls the appropriate
 * callbacks.
 */
export const InteractivePromptRouter = ({
  prompt,
  onFinished,
  onWordPromptResponse,
  countdown,
  subtitle,
  paused,
}: InteractivePromptRouterProps): ReactElement => {
  if (prompt.prompt.style === 'word') {
    return (
      <WordPrompt
        prompt={prompt}
        onFinished={onFinished}
        onResponse={onWordPromptResponse}
        countdown={countdown}
        subtitle={subtitle}
        paused={paused}
      />
    );
  } else if (prompt.prompt.style === 'numeric') {
    return (
      <NumericPrompt
        prompt={prompt}
        onFinished={onFinished}
        countdown={countdown}
        subtitle={subtitle}
        paused={paused}
      />
    );
  }

  return <ErrorBlock>This prompt is not supported on this platform yet.</ErrorBlock>;
};
