import { CrudFetcherMapper } from '../../../admin/crud/CrudFetcher';

/**
 * The raw representation provided when the server is including a reference to
 * a journal entry in the screen parameters.
 */
export type ScreenJournalEntryAPI = {
  /** The uid of the journal entry */
  uid: string;
  /** The journal entry JWT, which allows responding to it or creating a sync job to fetch its contents */
  jwt: string;
};

/**
 * The parsed representation provided when the server is including a reference to
 * a journal entry in the screen parameters
 */
export type ScreenJournalEntryParsed = ScreenJournalEntryAPI;

export const screenJournalEntryKeyMap: CrudFetcherMapper<ScreenJournalEntryParsed> = {};
