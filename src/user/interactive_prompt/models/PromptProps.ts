import { MutableRefObject } from 'react';
import { CountdownTextConfig } from '../components/CountdownText';
import { InteractivePrompt } from './InteractivePrompt';
import { PromptOnFinished } from './PromptOnFinished';

/**
 * Props used to display any of the specific prompt types, e.g.,
 * the WordPrompt, NumericPrompt, etc.
 *
 * P is the InteractivePrompt type, which is usually InteractiveWordPrompt
 * for WordPrompt, InteractiveNumericPrompt for NumericPrompt, etc.
 *
 * R is the response type, e.g., string | null for WordPrompt, number for NumericPrompt, etc.
 */
export type PromptProps<P extends InteractivePrompt, R> = {
  /**
   * The prompt to display. Must be a word prompt.
   */
  prompt: P;

  /**
   * The function to call when the user finishes the prompt.
   */
  onFinished: PromptOnFinished<R>;

  /**
   * If specified, the function to call when the user selects a response. This
   * should be called with the initial value at least once during initialization.
   * This function may be treated as idempotent, i.e., repeated calls are allowed
   * (though should be relatively infrequent). For example, the prompt type may
   * choose to call it again if the onResponse callback is changed.
   *
   * @param response The value of the option the user selected.
   */
  onResponse?: (response: R) => void;

  /**
   * If specified, a countdown is displayed using the given props.
   */
  countdown?: CountdownTextConfig;

  /**
   * If specified, a subtitle is displayed with the given contents,
   * e.g., "Class Poll".
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
