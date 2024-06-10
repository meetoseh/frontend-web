import { RequestHandler } from '../../../../../shared/requests/RequestHandler';
import { getJwtExpiration } from '../../../../../shared/lib/getJwtExpiration';
import { HTTP_API_URL } from '../../../../../shared/ApiConstants';
import { createGetDataFromRefUsingSignal } from '../../../../../shared/images/createGetDataFromRefUsingSignal';
import { OsehTranscriptRef } from '../../../../../shared/transcripts/OsehTranscriptRef';
import { OsehTranscript } from '../../../../../shared/transcripts/OsehTranscript';

/**
 * Creates a request handler for downloading transcripts
 */
export const createTranscriptRequestHandler = ({
  logging = 'none',
  maxStale = 100,
  maxRetries = 3,
}: {
  logging?: 'buffer' | 'direct' | 'none';
  maxStale?: number;
  maxRetries?: number;
}): RequestHandler<Pick<OsehTranscriptRef, 'uid'>, OsehTranscriptRef, OsehTranscript> => {
  return new RequestHandler({
    getRefUid,
    getDataFromRef,
    compareRefs,
    logConfig: { logging },
    cacheConfig: { maxStale, keepActiveRequestsIntoStale: true },
    retryConfig: { maxRetries },
  });
};

const getRefUid = (ref: Pick<OsehTranscriptRef, 'uid'>): string => ref.uid;
const getDataFromRef = createGetDataFromRefUsingSignal({
  inner: async (ref: OsehTranscriptRef, signal): Promise<OsehTranscript> => {
    const response = await fetch(`${HTTP_API_URL}/api/1/transcripts/${ref.uid}`, {
      method: 'GET',
      headers: {
        Authorization: `bearer ${ref.jwt}`,
      },
    });

    if (!response.ok) {
      throw response;
    }
    const rawTranscript: {
      uid: string;
      phrases: {
        starts_at: number;
        ends_at: number;
        phrase: string;
      }[];
    } = await response.json();
    const transcript: OsehTranscript = {
      uid: rawTranscript.uid,
      phrases: rawTranscript.phrases.map((phrase) => ({
        startsAt: phrase.starts_at,
        endsAt: phrase.ends_at,
        phrase: phrase.phrase,
      })),
    };
    return transcript;
  },
});
const compareRefs = (a: OsehTranscriptRef, b: OsehTranscriptRef): number =>
  getJwtExpiration(b.jwt) - getJwtExpiration(a.jwt);
