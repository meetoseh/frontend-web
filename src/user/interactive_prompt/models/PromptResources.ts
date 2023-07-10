import { ValueWithCallbacks, WritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { ProfilePicturesState } from '../hooks/useProfilePictures';
import { PromptTime } from '../hooks/usePromptTime';
import { Stats } from '../hooks/useStats';
import { InteractivePrompt } from './InteractivePrompt';

/**
 * Describes the resources loaded by a typical prompt
 * (WordPrompt/NumericPrompt/etc). This is typically loaded via the
 * usePromptResources hook and is available immediately.
 *
 * This is all that's required to render the prompt, so a prompt
 * implementation usually works like
 *
 * ```tsx
 * const settings: PromptSettings<InteractiveWordPrompt, string | null> = {
 *   // a few things are required here, like how to get the response distribution from
 *   // the stats and how to store the response. Mostly functions.
 * };
 *
 * export const WordPrompt = (props: PromptProps<InteractiveWordPrompt, string | null>) => {
 *   const resources = usePromptResources(props, settings);
 *   return <></>; // straight to rendering stuff here
 * }
 * ```
 *
 * This currently only supports prompts with a fixed number of responses, e.g.,
 * choose from a list of words/numbers. This allows for assuming the technique
 * used for client side prediction, which simplifies usage.
 *
 * P is the interactive prompt type, e.g., InteractiveWordPromtp
 * R is the response type, e.g., string | null for word prompts
 */
export type PromptResources<P extends InteractivePrompt, R> = {
  /**
   * The interactive prompt itself. We store this as a react managed value
   * since essentially every hook needs to be redone when this changes.
   */
  prompt: P;

  /**
   * The clock for the prompt
   */
  time: ValueWithCallbacks<PromptTime>;

  /**
   * The response statistics at this point in the prompt, from the server,
   * before client-side prediction.
   */
  stats: ValueWithCallbacks<Stats>;

  /**
   * A list of pictures of people who are in the prompt at this time.
   */
  profilePictures: ValueWithCallbacks<ProfilePicturesState>;

  /**
   * The index of the current selected response. Changing this value
   * will also update selectedValue and update clientPredictedResponseDistribution
   */
  selectedIndex: WritableValueWithCallbacks<number | null>;

  /**
   * The value of the current selected response
   */
  selectedValue: ValueWithCallbacks<R>;

  /**
   * The response distribution at this point in the prompt, as an array where
   * each index corresponds to the number of people with the response at that
   * index. For example, for a word prompt with 3 options, the value at index 0
   * is the number of people who have chosen the first option.
   *
   * This is a subset of the stats which depends on the prompt type, and
   * includes client side prediction: this value changes immediately when the
   * users response changes even before we receive a response from the server,
   * and then converges to the server value.
   */
  clientPredictedResponseDistribution: ValueWithCallbacks<number[]>;

  /**
   * A function which should be called if the user wants to skip
   * the prompt. This will ensure the leave event is sent appropriately
   * and inform the parent component that the prompt is done.
   */
  onSkip: () => void;
};
