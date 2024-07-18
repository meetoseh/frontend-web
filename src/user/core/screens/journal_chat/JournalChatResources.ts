import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ScreenResources } from '../../models/Screen';
import { JournalChatState } from './lib/JournalChatState';

export type JournalChatResources = ScreenResources & {
  /**
   * Null while the chat is loading, undefined if an error occurred, otherwise the
   * state of the chat
   */
  chat: ValueWithCallbacks<JournalChatState | null | undefined>;

  /**
   * The journal entry uid, if its been initialized successfully, otherwise null
   * NOTE: For now, this is only initialized once the system response has been
   * received as we don't have a full state machine for continuous messaging
   */
  journalEntryUID: ValueWithCallbacks<string | null>;

  /**
   * The JWT for accessing the journal entry, if available, otherwise null
   * NOTE: For now, this is only initialized once the system response has been
   * received as we don't have a full state machine for continuous messaging
   */
  journalEntryJWT: ValueWithCallbacks<string | null>;

  /**
   * Can be used to submit the users reply
   */
  trySubmitUserResponse: (userResponse: string) => void;
};
