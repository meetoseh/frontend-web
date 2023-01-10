import { ReactElement } from 'react';
import { Prompt } from './Journey';
import { JourneyPromptProps } from './models/JourneyPromptProps';
import { NumericJourneyPrompt } from './prompts/NumericJourneyPrompt';
import { PressJourneyPrompt } from './prompts/PressJourneyPrompt';

const PROMPT_STYLE_TO_COMPONENT: Record<
  Prompt['style'],
  (props: JourneyPromptProps) => ReactElement
> = {
  numeric: (props) => <NumericJourneyPrompt {...props} />,
  word: (props) => <>word prompt not implemented</>,
  press: (props) => <PressJourneyPrompt {...props} />,
  color: (props) => <>color prompt not implemented</>,
};

/**
 * Displays the prompt for a journey, which can be in form of various different
 * styles, graphically and playfully showing how other users are responding to
 * the prompt.
 */
export const JourneyPrompt = (props: JourneyPromptProps): ReactElement => {
  if (props.prompt.style in PROMPT_STYLE_TO_COMPONENT) {
    return PROMPT_STYLE_TO_COMPONENT[props.prompt.style](props);
  }

  return <></>;
};
