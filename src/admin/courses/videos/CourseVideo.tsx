import { OsehContentRef } from '../../../shared/content/OsehContentRef';
import { CrudFetcherMapper } from '../../crud/CrudFetcher';

export type CourseVideo = {
  /** Primary stable external identifier */
  uid: string;

  /** The underlying content file containing the video */
  contentFile: OsehContentRef;

  /** The SHA512 hash of the source video */
  contentFileOriginalSHA512: string;

  /** When the content file was created, i.e., the original file was first seen */
  contentFileCreatedAt: Date;

  /** The sub of the user who first uploaded the video, if known */
  uploadedByUserSub: string | null;

  /** When the source file was last uploaded */
  lastUploadedAt: Date;
};

export const courseVideoKeyMap: CrudFetcherMapper<CourseVideo> = {
  content_file: 'contentFile',
  content_file_original_sha512: 'contentFileOriginalSHA512',
  content_file_created_at: (_, v) => ({ key: 'contentFileCreatedAt', value: new Date(v * 1000) }),
  uploaded_by_user_sub: 'uploadedByUserSub',
  last_uploaded_at: (_, v) => ({ key: 'lastUploadedAt', value: new Date(v * 1000) }),
};
