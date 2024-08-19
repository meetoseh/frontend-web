import { WrappedJournalClientKey } from '../../../../../shared/journals/clientKeys';
import { getCurrentServerTimeMS } from '../../../../../shared/lib/getCurrentServerTimeMS';
import { JournalEntryItemData } from '../../journal_chat/lib/JournalChatState';

/** The payload within `encrypted_payload` on a JournalEntryAPI object */
export type JournalEntryAPIPayload = {
  /**
   * When the entry was created in seconds since the epoch. This is not, necessarily,
   * a meaningful time from the users perspective.
   */
  created_at: number;

  /**
   * A canonical time for the journal entry in seconds since the epoch. This value can
   * change over the lifetime of the journal entry and is intended to be set such that
   * if you are showing just one "time" the journal entry occurred, it will be the most
   * meaningful time to show.
   */
  canonical_at: number;

  /**
   * The entry items within the journal entry
   */
  items: JournalEntryItemData[];
};

export type JournalEntryPayloadMapped = {
  /**
   * When the entry was created. This is not, necessarily, a meaningful time
   * from the users perspective.
   */
  createdAt: Date;

  /**
   * A canonical time for the journal entry. This value can change over the
   * lifetime of the journal entry and is intended to be set such that if you
   * are showing just one "time" the journal entry occurred, it will be the most
   * meaningful time to show.
   */
  canonicalAt: Date;

  /**
   * The entry items within the journal entry
   */
  items: JournalEntryItemData[];
};

export type JournalEntryAPI = {
  /**
   * The primary stable external identifier for the journal entry
   */
  uid: string;

  /** The fernet token containing a JournalEntryAPIPayload */
  encrypted_payload: string;
};

export type JournalEntry = {
  /**
   * The primary stable external identifier for the journal entry
   */
  uid: string;

  /** The decrypted payload within `encrypted_payload` */
  payload: JournalEntryPayloadMapped;
};

/**
 * Produces a usable representation of the journal entry from the API representation.
 */
export const decryptJournalEntryAPI = async ({
  api,
  clientKey,
}: {
  api: JournalEntryAPI;
  clientKey: WrappedJournalClientKey;
}): Promise<JournalEntry> => {
  const now = await getCurrentServerTimeMS();
  const decrypted = await clientKey.key.decrypt(api.encrypted_payload, now);
  const payload: JournalEntryAPIPayload = JSON.parse(decrypted);
  return {
    uid: api.uid,
    payload: {
      createdAt: new Date(payload.created_at * 1000),
      canonicalAt: new Date(payload.canonical_at * 1000),
      items: payload.items,
    },
  };
};
