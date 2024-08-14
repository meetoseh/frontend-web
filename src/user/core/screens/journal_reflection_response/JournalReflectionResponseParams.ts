import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerAPI,
} from '../../models/ScreenConfigurableTrigger';
import { ScreenJournalEntryAPI } from '../../models/ScreenJournalChat';

export type JourneyReflectionResponseAPIParams = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** the header text to show */
  header: string;

  /** the journal entry whose reflection response to add or edit */
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

  /**
   * configures the api request to add a reflection response to the end of the
   * journal entry. provided with the same parameters as for the sync endpoint,
   * plus
   *
   * - `encrypted_reflection_response`: the new reflection response, encrypted
   *
   * we expect the same response as the sync endpoint
   */
  add: {
    /** the endpoint to use */
    endpoint: string;
  };

  /**
   * configures the api request to edit the reflection response. provided with
   * the same parameters as for the sync endpoint, plus
   *
   * - `encrypted_reflection_response`: the new reflection response, encrypted
   * - `entry_counter`: the entry counter of the journal entry item being edited
   *
   * we expect the same response as the sync endpoint
   */
  edit: {
    /** the endpoint to use */
    endpoint: string;
  };
};

export type JourneyReflectionResponseMappedParams = Pick<
  JourneyReflectionResponseAPIParams,
  'entrance' | 'header' | 'add' | 'edit'
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
