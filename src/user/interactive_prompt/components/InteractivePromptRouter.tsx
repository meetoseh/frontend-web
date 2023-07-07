import { MutableRefObject, ReactElement } from 'react';
import { ErrorBlock } from '../../../shared/forms/ErrorBlock';
import {
  InteractiveColorPrompt,
  InteractiveNumericPrompt,
  InteractivePrompt,
  InteractiveWordPrompt,
} from '../models/InteractivePrompt';
import { ColorPrompt } from './ColorPrompt';
import { CountdownTextConfig } from './CountdownText';
import { NumericPrompt } from './NumericPrompt';
import { WordPrompt } from './WordPrompt';
import { PromptOnFinished } from '../models/PromptOnFinished';

type InteractivePromptRouterPropsBase = {
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
   *
   * If more control is required, instead of `true`, an object containing
   * more configuration can be passed.
   */
  finishEarly?: boolean | { cta: string };

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

type InteractivePromptRouterProps =
  | (InteractivePromptRouterPropsBase & {
      prompt: InteractiveColorPrompt;
      onFinished: PromptOnFinished<string | null>;
    })
  | (InteractivePromptRouterPropsBase & {
      prompt: InteractiveWordPrompt;
      onFinished: PromptOnFinished<string | null>;
    })
  | (InteractivePromptRouterPropsBase & {
      prompt: InteractiveNumericPrompt;
      onFinished: PromptOnFinished<number | null>;
    })
  | (InteractivePromptRouterPropsBase & {
      prompt: InteractivePrompt;
      onFinished: PromptOnFinished<unknown>;
    });

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
    // not sure why typecheck can't determine that onFinished must be string | null here
    return (
      <WordPrompt
        prompt={prompt}
        onFinished={onFinished as PromptOnFinished<string | null>}
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
        onFinished={onFinished as PromptOnFinished<number | null>}
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
        onFinished={onFinished as PromptOnFinished<string | null>}
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
