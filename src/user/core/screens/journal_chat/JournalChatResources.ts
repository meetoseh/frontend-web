import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ScreenResources } from '../../models/Screen';
import { JournalChatState } from './lib/JournalChatState';

export type JournalChatResources = ScreenResources & {
  /**
   * The current state of the chat; null while initially loading, undefined if an
   * error occurred
   */
  chat: ValueWithCallbacks<JournalChatState | null | undefined>;

  /**
   * The journal entry uid we are looking at, null if unavailable
   */
  journalEntryUID: ValueWithCallbacks<string | null>;

  /**
   * The latest JWT for accessing the journal entry, null if unavailable
   */
  journalEntryJWT: ValueWithCallbacks<string | null>;

  /**
   * Submits the users response, which will cause the chat state to get updated in turn
   */
  trySubmitUserResponse: (userResponse: string) => void;
};
