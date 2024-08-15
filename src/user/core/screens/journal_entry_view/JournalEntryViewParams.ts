import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerAPI,
} from '../../models/ScreenConfigurableTrigger';
import { ScreenJournalEntryAPI } from '../../models/ScreenJournalChat';

export type JournalEntryViewAPIParams = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** the header text to show */
  header: string;

  /** the journal entry to show */
  journal_entry: ScreenJournalEntryAPI;

  /** configures the call to action */
  cta: {
    /** the text on the button */
    text: string;
    /** the trigger when the cta is pressed */
    trigger: ScreenConfigurableTriggerAPI;
    /** exit transition */
    exit: StandardScreenTransition;
  };

  /** configures the close button */
  close: {
    /** the variant to use for the icon and placement */
    variant: 'x' | 'back' | 'menu';
    /** the trigger when the close button is pressed */
    trigger: ScreenConfigurableTriggerAPI;
    /** exit transition */
    exit: StandardScreenTransition;
  };
};

export type JournalEntryViewMappedParams = Pick<
  JournalEntryViewAPIParams,
  'entrance' | 'header'
> & {
  /** the journal entry whose reflection question to show */
  journalEntry: ScreenJournalEntryAPI;

  /** configures the call to action */
  cta: {
    /** the text on the button */
    text: string;
    /** the trigger when the cta is pressed */
    trigger: ScreenConfigurableTrigger;
    /** exit transition */
    exit: StandardScreenTransition;
  };

  /** configures the close button */
  close: {
    /** the variant to use for the icon and placement */
    variant: 'x' | 'back' | 'menu';
    /** the trigger when the close button is pressed */
    trigger: ScreenConfigurableTrigger;
    /** exit transition */
    exit: StandardScreenTransition;
  };

  __mapped: true;
};
