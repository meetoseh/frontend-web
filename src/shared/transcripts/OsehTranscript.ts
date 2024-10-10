import { CrudFetcherMapper } from '../../admin/crud/CrudFetcher';

export type OsehTranscriptPhrase = {
  /**
   * When the phrase begins in seconds from the beginning of the recording
   */
  startsAt: number;

  /**
   * When the phrase ends in seconds from the beginning of the recording
   */
  endsAt: number;

  /**
   * The actual text of the phrase
   */
  phrase: string;
};

export type OsehTranscript = {
  /**
   * Primary stable external unique identifier for the transcript
   */
  uid: string;

  /**
   * The phrases in ascending order of starts at, ends at usually non-overlapping,
   * but often not partitioning the entire recording due to periods of
   * silence
   */
  phrases: OsehTranscriptPhrase[];
};

export const osehTranscriptMapper: CrudFetcherMapper<OsehTranscript> = (raw) => {
  return {
    uid: raw.uid,
    phrases: (raw.phrases as any[]).map((p) => ({
      startsAt: p.starts_at,
      endsAt: p.ends_at,
      phrase: p.phrase,
    })),
  };
};
