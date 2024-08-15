import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ScreenResources } from '../../models/Screen';
import { JournalEntryMetadata } from '../journal_chat/lib/createJournalEntryMetadataRequestHandler';
import { JournalChatState } from '../journal_chat/lib/JournalChatState';

export type JournalEntryViewResources = ScreenResources & {
  /**
   * The current state of the chat; null while initially loading, undefined if an
   * error occurred
   */
  chat: ValueWithCallbacks<JournalChatState | null | undefined>;

  /**
   * The metadata for the journal entry; null while initially loading, undefined
   * if an error occurred
   */
  metadata: ValueWithCallbacks<JournalEntryMetadata | null | undefined>;
};
