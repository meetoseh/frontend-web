import { convertUsingMapper, CrudFetcherMapper } from '../../../../admin/crud/CrudFetcher';
import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerAPI,
  screenConfigurableTriggerMapper,
} from '../../models/ScreenConfigurableTrigger';

type JournalEntriesListAPIParamsTooltip = {
  /** Header for the tooltip */
  header: string;

  /** Body of the tooltip */
  body: string;
};

type JournalEntriesListAPIParamsCTA = {
  /** The text for the call to action */
  text: string;

  /** The trigger when the user clicks the button */
  trigger: ScreenConfigurableTriggerAPI;

  /** exit transition for cta */
  exit: StandardScreenTransition;
};

export type JournalEntriesListMappedParamsTooltip = JournalEntriesListAPIParamsTooltip;
export type JournalEntriesListMappedParamsCTA = {
  /** The text for the call to action */
  text: string;
  /** The trigger when the user clicks the button, with no parameters */
  trigger: ScreenConfigurableTrigger;
  /** exit transition for cta */
  exit: StandardScreenTransition;
};

export type JournalEntriesListAPIParams = {
  /** The text to put in the header */
  header: string;

  /** The tooltip above the first journal entry, if any */
  tooltip: JournalEntriesListAPIParamsTooltip | null;

  /** The call to action, if any, displayed as a bottom button */
  cta: JournalEntriesListAPIParamsCTA | null;

  /** configures the close button */
  close: {
    /** the variant to use for the icon and placement */
    variant: 'x' | 'back' | 'menu';
    /** the trigger when the close button is pressed */
    trigger: ScreenConfigurableTriggerAPI;
    /** exit transition */
    exit: StandardScreenTransition;
  };

  /** entrance transition */
  entrance: StandardScreenTransition;

  /** how to handle when a journal entry is clicked; we include `journal_entry_uid` in the params */
  journal_entry_trigger: ScreenConfigurableTriggerAPI;

  /**
   * how to handle when the edit button on a journal entry is clicked; we include
   * `journal_entry_uid` in the params
   */
  journal_entry_edit_trigger: ScreenConfigurableTriggerAPI;
};

export type JournalEntriesListMappedParams = {
  /** The text to put in the header */
  header: string;

  /** The tooltip above the first series, if any */
  tooltip: JournalEntriesListMappedParamsTooltip | null;

  /** The call to action, if any, displayed as a bottom button */
  cta: JournalEntriesListMappedParamsCTA | null;

  /** configures the close button */
  close: {
    /** the variant to use for the icon and placement */
    variant: 'x' | 'back' | 'menu';
    /** the trigger when the close button is pressed */
    trigger: ScreenConfigurableTrigger;
    /** exit transition */
    exit: StandardScreenTransition;
  };

  /** entrance transition */
  entrance: StandardScreenTransition;

  /**
   * How to handle when a journal entry is clicked; we include `journal_entry_uid` in the params
   */
  journalEntryTrigger: ScreenConfigurableTrigger;

  /**
   * How to handle when the edit button on a journal entry is clicked; we include
   * `journal_entry_uid` in the params
   */
  journalEntryEditTrigger: ScreenConfigurableTrigger;

  __mapped: true;
};

export const journalEntriesListParamsMapper: CrudFetcherMapper<JournalEntriesListMappedParams> = (
  raw
) => {
  const api = raw as JournalEntriesListAPIParams;
  return {
    header: api.header,
    tooltip: api.tooltip,
    cta:
      api.cta === null || api.cta === undefined
        ? null
        : {
            text: api.cta.text,
            trigger: convertUsingMapper(api.cta.trigger, screenConfigurableTriggerMapper),
            exit: api.cta.exit,
          },
    close: {
      variant: api.close.variant,
      trigger: convertUsingMapper(api.close.trigger, screenConfigurableTriggerMapper),
      exit: api.close.exit,
    },
    entrance: api.entrance,
    journalEntryTrigger: convertUsingMapper(
      api.journal_entry_trigger,
      screenConfigurableTriggerMapper
    ),
    journalEntryEditTrigger: convertUsingMapper(
      api.journal_entry_edit_trigger,
      screenConfigurableTriggerMapper
    ),
    __mapped: true,
  };
};
