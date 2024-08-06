import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerTransitioningPreferredAPI,
  ScreenConfigurableTriggerTransitioningTemporaryAPI,
} from '../../models/ScreenConfigurableTrigger';

export type FeedbackAPIParams = {
  /** Message at the top, usually to provide context */
  top: string;

  /** The header message */
  header: string;

  /** The subheader message */
  message: string;

  /** The placeholder for the input */
  placeholder: string;

  /** Details below the feedback text input; null for no details */
  details: string | null;

  /** The call-to-action text on the button. */
  cta: string;

  /** If provided, a secondary call to action is presented (usually for "more info") */
  cta2: {
    /** The text to render */
    text: string;
    /** The trigger if the secondary cta is pressed, null otherwise */
    trigger: ScreenConfigurableTriggerTransitioningPreferredAPI;
    triggerv75: ScreenConfigurableTriggerTransitioningTemporaryAPI;
  } | null;

  /** The trigger if they hit the x button at the upper right */
  close: ScreenConfigurableTriggerTransitioningPreferredAPI;
  closev75: ScreenConfigurableTriggerTransitioningTemporaryAPI;

  /**
   * An arbitrary identifier to associate with this feedback. Generally,
   * this is used to make it easier to collect related feedback
   */
  slug: string;

  /**
   * Determines whether or not to allow anonymous feedback.
   *
   * - `opt-in`: a checkbox is presented, which is unchecked by default
   * - `opt-out`: a checkbox is presented, which is checked by default
   * - `require`: no checkbox is presented and the feedback is anonymized
   * - `forbid`: no checkbox is presented and the feedback is not anonymized
   *
   * Generally, unless its `forbid`, details should be used to explain that
   * we will be able to initially determine the user's identity for abuse
   * protection, but we will not store / log / use it beyond that.
   */
  anonymous: 'opt-in' | 'opt-out' | 'require' | 'forbid';

  anonymous_label: string;

  /** entrance transition */
  entrance: StandardScreenTransition;

  /** exit transition for cta */
  exit: StandardScreenTransition;

  /** The client flow slug to trigger when they hit the button with no parameters */
  trigger: ScreenConfigurableTriggerTransitioningPreferredAPI;
  triggerv75: ScreenConfigurableTriggerTransitioningTemporaryAPI;
};

export type FeedbackMappedParams = Omit<
  FeedbackAPIParams,
  'anonymous_label' | 'close' | 'closev75' | 'trigger' | 'triggerv75' | 'cta2'
> & {
  /** The label to use for the anonymous checkbox for opt-in or opt-out strategies */
  anonymousLabel: string;
  cta2: {
    text: string;
    trigger: ScreenConfigurableTrigger;
  } | null;
  close: ScreenConfigurableTrigger;
  trigger: ScreenConfigurableTrigger;
  __mapped: true;
};
