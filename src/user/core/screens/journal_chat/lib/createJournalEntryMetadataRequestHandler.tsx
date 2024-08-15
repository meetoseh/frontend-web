import { apiFetch } from '../../../../../shared/ApiConstants';
import { LoginContextValueLoggedIn } from '../../../../../shared/contexts/LoginContext';
import { Visitor } from '../../../../../shared/hooks/useVisitorValueWithCallbacks';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { deleteClientKey, getOrCreateClientKey } from '../../../../../shared/journals/clientKeys';
import { createFernet } from '../../../../../shared/lib/fernet';
import { getCurrentServerTimeMS } from '../../../../../shared/lib/getCurrentServerTimeMS';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import { VISITOR_SOURCE } from '../../../../../shared/lib/visitorSource';
import { RequestHandler } from '../../../../../shared/requests/RequestHandler';

export type JournalEntryMetadataRef = {
  /** The latest logged in user credentials */
  user: LoginContextValueLoggedIn;

  /** The latest visitor information */
  visitor: Visitor;

  /** The unique identifier of the journal entry */
  uid: string;

  /** The JWT that provides access to the journal entries metadata */
  jwt: string;

  /** the consistency to use for the initial request */
  minConsistency: 'none' | 'weak';
};

export type JournalEntryMetadataMinimalRef = Pick<JournalEntryMetadataRef, 'uid'>;

export type JournalEntryMetadata = {
  /** When the journal entry was created */
  createdAt: Date;

  /**
   * The canonical timestamp that should be used if only one timestamp is
   * being shown for the journal entry. This gets changed as the entry is
   * changed, typically only when the user performs some meaningful action
   */
  canonicalAt: Date;
};

/**
 * Creates a request handler capable of retrieving metadata on journal
 * entries
 */
export const createJournalEntryMetadataRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<
  JournalEntryMetadataMinimalRef,
  JournalEntryMetadataRef,
  JournalEntryMetadata
> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: JournalEntryMetadataMinimalRef): string => ref.uid;
const getDataFromRef = createGetDataFromRefUsingSignal({
  inner: async (ref: JournalEntryMetadataRef, signal): Promise<JournalEntryMetadata> => {
    const clientKey = await getOrCreateClientKey(ref.user, ref.visitor);
    const resp = await apiFetch(
      '/api/1/journals/entries/show_metadata',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          platform: VISITOR_SOURCE,
          journal_entry_uid: ref.uid,
          journal_entry_jwt: ref.jwt,
          journal_client_key_uid: clientKey.uid,
          min_consistency: ref.minConsistency,
        }),
        signal,
      },
      ref.user
    );
    if (!resp.ok) {
      if (resp.status === 404) {
        const body = await resp.json();
        if (body.type === 'key_unavailable') {
          await deleteClientKey(clientKey.uid);
        }
      }
      throw resp;
    }
    const data: { encrypted_payload: string } = await resp.json();

    const fernet = await createFernet(clientKey.key);
    const nowServerMS = await getCurrentServerTimeMS();
    const decryptedPayloadStr = await fernet.decrypt(data.encrypted_payload, nowServerMS);
    const decryptedPayload: { uid: string; created_at: number; canonical_at: number } =
      JSON.parse(decryptedPayloadStr);
    if (decryptedPayload.uid !== ref.uid) {
      throw new Error('uid mismatch');
    }
    return {
      createdAt: new Date(decryptedPayload.created_at * 1000),
      canonicalAt: new Date(decryptedPayload.canonical_at * 1000),
    };
  },
  isExpired: (ref, nowServer) => {
    const jwtExpiresAt = getJwtExpiration(ref.jwt);
    if (jwtExpiresAt <= nowServer) {
      return true;
    }

    const userExpiresAt = getJwtExpiration(ref.user.authTokens.idToken);
    if (userExpiresAt <= nowServer) {
      return true;
    }

    return false;
  },
});
const compareRefs = (a: JournalEntryMetadataRef, b: JournalEntryMetadataRef): number =>
  Math.min(getJwtExpiration(b.jwt), getJwtExpiration(b.user.authTokens.idToken)) -
  Math.min(getJwtExpiration(a.jwt), getJwtExpiration(a.user.authTokens.idToken));
