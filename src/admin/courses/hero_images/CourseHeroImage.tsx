import { OsehImageRef } from '../../../shared/images/OsehImageRef';
import { CrudFetcherMapper } from '../../crud/CrudFetcher';

/** A course hero image for a share page */
export type CourseHeroImage = {
  /** The primary stable external identifier */
  uid: string;

  /** The actual image file, with mobile square exports and desktop 4:3 exports */
  imageFile: OsehImageRef;

  /** When the image file was first created */
  imageFileCreatedAt: Date;

  /** When the source file was last uploaded */
  lastUploadedAt: Date;
};

export const courseHeroImageKeyMap: CrudFetcherMapper<CourseHeroImage> = {
  image_file: 'imageFile',
  image_file_created_at: (_, v) => ({ key: 'imageFileCreatedAt', value: new Date(v * 1000) }),
  last_uploaded_at: (_, v) => ({ key: 'lastUploadedAt', value: new Date(v * 1000) }),
};
