import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ScreenResources } from '../../models/Screen';

export type JournalReflectionLargeResources = ScreenResources & {
  /**
   * The current reflection question; null while loading, undefined if an error
   * occurred. Provided as a series of paragraphs.
   */
  question: ValueWithCallbacks<{ entryCounter: number; paragraphs: string[] } | null | undefined>;

  /**
   * The journal entry uid we are looking at, null if unavailable
   */
  journalEntryUID: ValueWithCallbacks<string | null>;

  /**
   * The latest JWT for accessing the journal entry, null if unavailable
   */
  journalEntryJWT: ValueWithCallbacks<string | null>;

  /**
   * Submits a new version of the reflection question; this will cause the
   * chat to be updated if successful
   */
  trySubmitEdit: (userResponse: string) => void;

  /**
   * Asks the backend to generate a new reflection question for the user;
   * this will cause the chat to be updated if successful
   */
  tryRegenerate: () => void;
};
