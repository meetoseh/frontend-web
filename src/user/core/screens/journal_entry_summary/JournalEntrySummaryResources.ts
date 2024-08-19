import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ScreenResources } from '../../models/Screen';
import { JournalEntryItemDataDataSummaryV1 } from '../journal_chat/lib/JournalChatState';

export type JournalEntrySummaryResources = ScreenResources & {
  /**
   * The current summary; null while loading, undefined if an error
   * occurred.
   */
  summary: ValueWithCallbacks<
    { entryCounter: number; data: JournalEntryItemDataDataSummaryV1 } | null | undefined
  >;

  /**
   * Submits a new version of the summary; this will cause the chat to be
   * updated if successful
   */
  trySubmitEdit: (data: JournalEntryItemDataDataSummaryV1) => void;

  /**
   * Asks the backend to generate a new reflection question for the user;
   * this will cause the chat to be updated if successful
   */
  tryRegenerate: () => void;
};
