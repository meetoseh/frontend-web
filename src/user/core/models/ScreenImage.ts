import { CrudFetcherMapper } from '../../../admin/crud/CrudFetcher';

/** Whats received from a `{"type": "string", "format": "image_uid"}` */
export type ScreenImageAPI = {
  /** Primary stable identifier for the image */
  uid: string;
  /** JWT for downloading the image playlist and images */
  jwt: string;
  /**
   * Thumbhash for the image at a standard size, which can be shown before
   * the playlist is downloaded
   */
  thumbhash: string;
};

export type ScreenImageParsed = ScreenImageAPI;

export const screenImageKeyMap: CrudFetcherMapper<ScreenImageParsed> = {};
