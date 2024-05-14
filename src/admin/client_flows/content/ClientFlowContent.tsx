import { OsehContentRef } from '../../../shared/content/OsehContentRef';
import { OsehTranscriptRef } from '../../../shared/transcripts/OsehTranscriptRef';
import { CrudFetcherMapper } from '../../crud/CrudFetcher';

export type ClientFlowContent = {
  /** Primary stable row identifier */
  uid: string;

  /** Stable, semantic identifier for how the image was processed */
  listSlug: string;

  /** The underlying content file */
  contentFile: OsehContentRef;

  /** The transcript for the content, if available */
  transcript?: OsehTranscriptRef | null;

  /**
   * The sha512 of the originally uploaded file, which may differ from
   * the `original_sha512` of the `contentFile` if there was a preprocessing
   * step. For example, if the uploaded file is a JSON thats used to produce
   * an video that is then used for the exports, this will be the sha512 of the
   * json file an the `original_sha512` of the `contentFile` will be the sha512
   * of the video.
   */
  originalFileSha512: string;

  /** When the content file record was created */
  contentFileCreatedAt: Date;

  /**
   * When the original content was last uploaded, which may be later
   * than the first time it was seen.
   */
  lastUploadedAt: Date;
};

export const clientFlowContentKeyMap: CrudFetcherMapper<ClientFlowContent> = {
  list_slug: 'listSlug',
  content_file: 'contentFile',
  transcript: 'transcript',
  original_file_sha512: 'originalFileSha512',
  content_file_created_at: (_, v) => ({ key: 'contentFileCreatedAt', value: new Date(v * 1000) }),
  last_uploaded_at: (_, v) => ({ key: 'lastUploadedAt', value: new Date(v * 1000) }),
};
