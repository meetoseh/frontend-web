import { OsehImageRef } from '../../../shared/images/OsehImageRef';
import { CrudFetcherMapper } from '../../crud/CrudFetcher';

/**
 * A reference to an image that is intended to be included within an
 * email template with a fixed CSS width and height
 */
export type EmailImage = {
  /** The unique identifier that can be used to form a URL to the image */
  uid: string;
  /** The underlying image */
  imageFile: OsehImageRef;
  /** The width and height that the image is expected to be rendered at in CSS pixels */
  size: { width: number; height: number };
  /** The SHA512 of the file that was processed */
  originalFileSha512: string;
  /** When the image was created at in seconds since the epoch */
  createdAt: Date;
};

export const emailImageKeyMap: CrudFetcherMapper<EmailImage> = {
  image_file: 'imageFile',
  original_file_sha512: 'originalFileSha512',
  created_at: (_, v) => ({ key: 'createdAt', value: new Date(v * 1000) }),
};
