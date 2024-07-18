import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';

export type JournalChatAPIParams = {
  /** The text in the title, e.g. 'Check-in' */
  title: string;

  /** 'input' to focus the input as soon as the screen is entered, false not to */
  focus: 'input' | 'none';

  /** The button to back out */
  back:
    | {
        /** Show a left caret button in the upper left */
        type: 'back';
        trigger: string | null;
      }
    | {
        /** Show an x in the upper right */
        type: 'x';
        trigger: string | null;
      }
    | {
        /** Don't present any way back */
        type: 'none';
      };

  upgrade_trigger: string;
  journey_trigger: string;

  /** entrance transition */
  entrance: StandardScreenTransition;

  /** exit transition */
  exit: StandardScreenTransition;
};

export type JournalChatMappedParams = Omit<
  JournalChatAPIParams,
  'upgrade_trigger' | 'journey_trigger'
> & {
  /**
   * The slug of the flow to trigger if the user taps on a journey
   * which requires Oseh+ but they do not have it
   */
  upgradeTrigger: string;
  /**
   * The slug of the flow to trigger if the user taps on a journey
   * which does not require Oseh+, or when they have Oseh+
   */
  journeyTrigger: string;
  __mapped: true;
};
