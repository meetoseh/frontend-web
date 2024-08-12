import { apiFetch } from '../ApiConstants';
import { LoginContextValueLoggedIn } from '../contexts/LoginContext';
import { WrappedJournalClientKey } from '../journals/clientKeys';
import { getCurrentServerTimeMS } from './getCurrentServerTimeMS';

type Alphabet = 'ascii';

const generateRandomString = (size: number, alphabet: Alphabet): [Uint8Array, string] => {
  // for right now, only ascii, which is just any value 0-127
  const result = crypto.getRandomValues(new Uint8Array(size));
  for (let i = 0; i < result.length; i++) {
    result[i] = result[i] % 128;
  }
  return [result, new TextDecoder().decode(result)];
};

/**
 * Tests our fernet encryption algorithm via the test endpoint.
 */
export const testFernet = async (
  user: LoginContextValueLoggedIn,
  key: WrappedJournalClientKey,
  matrix: {
    sizes: number[];
    alphabets: 'ascii'[];
    repetitions: number;
  }
) => {
  for (const alphabet of matrix.alphabets) {
    for (const size of matrix.sizes) {
      for (let repetition = 0; repetition < matrix.repetitions; repetition++) {
        const [payloadBytes, payloadStr] = generateRandomString(size, alphabet);
        const payloadSha256 = await crypto.subtle.digest('SHA-256', payloadBytes);
        const payloadSha256Hex = Array.from(new Uint8Array(payloadSha256))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

        const now = await getCurrentServerTimeMS();
        const encrypted = await key.key.encrypt(payloadStr, now);
        const decrypted = await key.key.decrypt(encrypted, now);
        if (payloadStr !== decrypted) {
          throw new Error(
            `our internal encryption/decryption failed for ${payloadStr}; encrypted=${encrypted}, decrypted=${decrypted}`
          );
        }

        const response = await apiFetch(
          '/api/1/journals/client_keys/test',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              journal_client_key_uid: key.uid,
              encrypted_payload: encrypted,
              expected_sha256: payloadSha256Hex,
            }),
          },
          user
        );
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`server failed to decrypt ${payloadStr} (${response.status}): ${body}`);
        }
      }
    }
  }
};
