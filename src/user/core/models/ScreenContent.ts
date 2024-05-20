import { CrudFetcherMapper } from '../../../admin/crud/CrudFetcher';
import { OsehContentRefLoadable } from '../../../shared/content/OsehContentRef';
import { OsehTranscriptRef } from '../../../shared/transcripts/OsehTranscriptRef';

/** Whats received from a `{"type": "string", "format": "content_uid"}` */
export type ScreenContentAPI = {
  /** The content to show */
  content: OsehContentRefLoadable;
  /** The transcript, if any is available, for the content */
  transcript?: OsehTranscriptRef | null;
};

export type ScreenContentParsed = Omit<ScreenContentAPI, 'transcript'> & {
  /** The transcript, if any is available, for the content */
  transcript: OsehTranscriptRef | null;
};

export const screenContentKeyMap: CrudFetcherMapper<ScreenContentParsed> = (raw) => ({
  content: raw.content,
  transcript: raw.transcript ?? null,
});
