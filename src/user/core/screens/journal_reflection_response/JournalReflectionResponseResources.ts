import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ScreenResources } from '../../models/Screen';

export type JournalReflectionResponseResources = ScreenResources & {
  /**
   * The current reflection question; null while loading, undefined if an error
   * occurred. Provided as a series of paragraphs.
   */
  question: ValueWithCallbacks<{ entryCounter: number; paragraphs: string[] } | null | undefined>;

  /**
   * The current reflection response on the server, provided as a single string
   * which may include newlines.
   *
   * Takes on the appropriate string literal if the response is loading, failed
   * to load due to an error, or does not exist.
   */
  savedResponse: ValueWithCallbacks<
    { entryCounter: number; value: string } | 'loading' | 'error' | 'dne'
  >;

  /**
   * The journal entry uid we are looking at, null if unavailable
   */
  journalEntryUID: ValueWithCallbacks<string | null>;

  /**
   * The latest JWT for accessing the journal entry, null if unavailable
   */
  journalEntryJWT: ValueWithCallbacks<string | null>;

  /**
   * Stores the user's response to the reflection question and returns a promise
   * which resolves when the response has been updated and rejects if an error
   * occurs.
   */
  updateResponse: (userResponse: string) => Promise<void>;
};
