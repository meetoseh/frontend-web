import { CrudFetcherMapper } from '../../../../admin/crud/CrudFetcher';
import { OsehImageRef } from '../../../../shared/images/OsehImageRef';

export type HomeScreenImage = {
  /** The actual image */
  image: OsehImageRef;
  /**
   * The thumbhash of the image at a standard resolution,
   * to reduce time to first paint.
   */
  thumbhash: string;
};

export const homeScreenImageMapper: CrudFetcherMapper<HomeScreenImage> = {};
