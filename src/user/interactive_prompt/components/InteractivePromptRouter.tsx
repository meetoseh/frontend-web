import { MutableRefObject, ReactElement } from 'react';
import { ErrorBlock } from '../../../shared/forms/ErrorBlock';
import { InteractivePrompt } from '../models/InteractivePrompt';
import { ColorPrompt } from './ColorPrompt';
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
   * @param privileged true if the user clicked a button to finish, false if the
   *   countdown ended without user interaction
   */
  onFinished: (privileged: boolean) => void;

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

  /**
   * If set to true, a more obvious button is included to let the user
   * move on. The button prominence is reduced until the user answers,
   * but still more prominent than the default X button.
   */
  finishEarly?: boolean;

  /**
   * If specified, used to configure the max width of the title in pixels.
   * It's often useful to configure this if the prompt title is known in
   * advance to get an aesthetically pleasing layout.
   */
  titleMaxWidth?: number;

  /**
   * The ref to register a leaving callback which must be called before unmounting
   * the component normally in order to trigger a leave event. Otherwise, a leave
   * event is only triggered when the prompt finishes normally or the page is
   * closed (via onbeforeunload)
   */
  leavingCallback: MutableRefObject<(() => void) | null>;
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
  finishEarly,
  titleMaxWidth,
  leavingCallback,
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
        finishEarly={finishEarly}
        titleMaxWidth={titleMaxWidth}
        leavingCallback={leavingCallback}
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
        finishEarly={finishEarly}
        titleMaxWidth={titleMaxWidth}
        leavingCallback={leavingCallback}
      />
    );
  } else if (prompt.prompt.style === 'color') {
    return (
      <ColorPrompt
        prompt={prompt}
        onFinished={onFinished}
        countdown={countdown}
        subtitle={subtitle}
        paused={paused}
        finishEarly={finishEarly}
        titleMaxWidth={titleMaxWidth}
        leavingCallback={leavingCallback}
      />
    );
  }

  return <ErrorBlock>This prompt is not supported on this platform yet.</ErrorBlock>;
};
