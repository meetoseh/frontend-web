import { MutableRefObject, ReactElement } from 'react';
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
import { BoxError, DisplayableError } from '../../../shared/lib/errors';

type InteractivePromptRouterPropsBase<R> = {
  /**
   * Called during initialization and after the user selects an option. This is
   * commonly used for using an interactive prompt for a settings page, which
   * adds a lot of flashiness.
   *
   * @param response The value of the option the user selected.
   */
  onResponse?: (response: R) => void;

  /**
   * The function to call when the prompt is complete and should no longer be
   * shown. For journeys this typically means moving onto audio, for settings
   * this can mean either restarting the interactive prompt or switching to
   * a static settings component.
   */
  onFinished: PromptOnFinished<R>;

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

type InteractivePromptRouterColorProps = InteractivePromptRouterPropsBase<string | null> & {
  prompt: InteractiveColorPrompt;
};

type InteractivePromptRouterWordProps = InteractivePromptRouterPropsBase<string | null> & {
  prompt: InteractiveWordPrompt;
};

type InteractivePromptRouterNumericProps = InteractivePromptRouterPropsBase<number | null> & {
  prompt: InteractiveNumericPrompt;
};

type InteractivePromptRouterGenericProps = InteractivePromptRouterPropsBase<unknown> & {
  prompt: InteractivePrompt;
};

type InteractivePromptRouterProps =
  | InteractivePromptRouterColorProps
  | InteractivePromptRouterWordProps
  | InteractivePromptRouterNumericProps
  | InteractivePromptRouterGenericProps;

/**
 * Renders an arbitrary interactive prompt and calls the appropriate
 * callbacks.
 */
export const InteractivePromptRouter = (props: InteractivePromptRouterProps): ReactElement => {
  if (props.prompt.prompt.style === 'word') {
    // not sure why typescript can't infer this type
    props = props as InteractivePromptRouterWordProps;
    return <WordPrompt {...props} />;
  } else if (props.prompt.prompt.style === 'numeric') {
    props = props as InteractivePromptRouterNumericProps;
    return <NumericPrompt {...props} />;
  } else if (props.prompt.prompt.style === 'color') {
    props = props as InteractivePromptRouterColorProps;
    return <ColorPrompt {...props} />;
  }

  return <BoxError error={new DisplayableError('client', 'show prompt', 'not supported')} />;
};
