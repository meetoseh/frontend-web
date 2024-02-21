import { OsehImageRef } from '../../../shared/images/OsehImageRef';
import { CrudFetcherMapper } from '../../crud/CrudFetcher';

export type CourseBackgroundImage = {
  /* Primary stable external identifier */
  uid: string;

  /**
   * The image file originally uploaded, cropped and resized to various
   * resolutions but not otherwise modified.
   */
  originalImageFile: OsehImageRef;

  /**
   * The image file, darkened, and then cropped and resized
   */
  darkenedImageFile: OsehImageRef;

  /**
   * When the original image file was created
   */
  imageFileCreatedAt: Date;

  /**
   * When the original image was last uploaded, which may be later
   * than the first time it was seen.
   */
  lastUploadedAt: Date;
};

export const courseBackgroundImageKeyMap: CrudFetcherMapper<CourseBackgroundImage> = {
  original_image_file: 'originalImageFile',
  darkened_image_file: 'darkenedImageFile',
  image_file_created_at: (_, v) => ({ key: 'imageFileCreatedAt', value: new Date(v * 1000) }),
  last_uploaded_at: (_, v) => ({ key: 'lastUploadedAt', value: new Date(v * 1000) }),
};
