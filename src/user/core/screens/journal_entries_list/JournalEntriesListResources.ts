import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ScreenResources } from '../../models/Screen';
import { JournalEntryListState } from './lib/createJournalEntryListRequestHandler';

export type JournalEntriesListResources = ScreenResources & {
  /**
   * The list of journal entries to render; null while still loading, undefined
   * if an error prevented loading.
   */
  list: ValueWithCallbacks<JournalEntryListState | null | undefined>;
};
