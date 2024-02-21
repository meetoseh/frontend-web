import { OsehImageRef } from '../../../shared/images/OsehImageRef';
import { CrudFetcherMapper } from '../../crud/CrudFetcher';

export type CourseLogo = {
  /** Primary stable external identifier */
  uid: string;

  /**
   * The actual image file, which will usually contain an SVG
   * and PNGs of that SVG at various resolutions
   */
  imageFile: OsehImageRef;

  /** When the image file was first created */
  imageFileCreatedAt: Date;

  /** When the source image was last uploaded */
  lastUploadedAt: Date;
};

export const courseLogoKeyMap: CrudFetcherMapper<CourseLogo> = {
  image_file: 'imageFile',
  image_file_created_at: (_, v) => ({ key: 'imageFileCreatedAt', value: new Date(v * 1000) }),
  last_uploaded_at: (_, v) => ({ key: 'lastUploadedAt', value: new Date(v * 1000) }),
};
