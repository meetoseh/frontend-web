import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerAPI,
} from '../../models/ScreenConfigurableTrigger';
import { ScreenJournalEntryAPI } from '../../models/ScreenJournalChat';

export type JournalEntrySummaryAPIParams = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** the header text to show */
  header: string;

  /** Small text below the summary for clarity on how the screen works */
  hint: string | null;

  /** the journal entry whose summary to show */
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
    /** if true, the close button is only shown if an error occurs */
    only_if_error: boolean;
    /** the trigger when the close button is pressed */
    trigger: ScreenConfigurableTriggerAPI;
    /** exit transition */
    exit: StandardScreenTransition;
  };

  /** configures the regenerate button below the cta; null for no regenerate button */
  regenerate: {
    /**
     * the sync-like endpoint to use
     * passed additional parameters:
     * - entry_counter: the entry counter of the journal entry item to regenerate
     */
    endpoint: string;
  } | null;

  /** configures the edit button and functionality; null for no edit button */
  edit: {
    /** the sync-like endpoint to use;
     * passed additional parameters:
     * - encrypted_summary: the v1 summary as a json object in the following form, encrypted:
     *   `{"type": "summary", "version": "v1", "title": "The title", "tags": ["tag1", "tag2"]}`
     * - entry_counter: the entry counter of the journal entry item being edited
     */
    endpoint: string;
  } | null;

  /**
   * configures what to do if the summary is missing but we think it
   * can be generated
   */
  missing_summary: {
    /**
     * the endpoint to use for each retry; if shorter than max_retries we repeat
     * the last item or, if empty, the default sync endpoint
     */
    endpoint: string[];
    /**
     * the maximum number of time to retry this type of issue; uses a retry
     * delay of instant, followed by in seconds of
     *
     * `2 ** attempt + uniform(0, 0.5)`.
     *
     * May be 0 to disable handling this type of error via retries at all.
     */
    max_retries: number;
  };
};

export type JournalEntrySummaryMappedParams = Pick<
  JournalEntrySummaryAPIParams,
  'entrance' | 'header' | 'hint' | 'regenerate' | 'edit'
> & {
  /** the journal entry whose summary to show */
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
    /** if true, the close button is only shown if an error occurs */
    onlyIfError: boolean;
    /** the trigger when the close button is pressed */
    trigger: ScreenConfigurableTrigger;
    /** exit transition */
    exit: StandardScreenTransition;
  };

  /**
   * configures what to do if the summary is missing but we think it
   * can be generated
   */
  missingSummary: {
    /**
     * the endpoint to use for each retry; if shorter than maxRetries we repeat
     * the last item or, if empty, the default sync endpoint
     */
    endpoint: string[];
    /**
     * the maximum number of time to retry this type of issue; uses a retry
     * delay of instant, followed by in seconds of
     *
     * `2 ** attempt + uniform(0, 0.5)`.
     *
     * May be 0 to disable handling this type of error via retries at all.
     */
    maxRetries: number;
  };
  __mapped: true;
};
