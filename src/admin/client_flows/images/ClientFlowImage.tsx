import { OsehImageRef } from '../../../shared/images/OsehImageRef';
import { CrudFetcherMapper } from '../../crud/CrudFetcher';

export type ClientFlowImage = {
  /** Primary stable row identifier */
  uid: string;

  /** Stable, semantic identifier for how this image was produiced */
  listSlug: string;

  /** The actual image file */
  imageFile: OsehImageRef;

  /**
   * The sha512 of the originally uploaded file, which may differ from
   * the `original_sha512` of the `imageFile` if there was a preprocessing
   * step. For example, if the uploaded file is a JSON thats used to produce
   * an SVG that is then used for the exports, this will be the sha512 of the
   * json file an the `original_sha512` of the `imageFile` will be the sha512
   * of the SVG.
   */
  originalFileSha512: string;

  /** When the image file record was first created */
  imageFileCreatedAt: Date;

  /**
   * When the original image was last uploaded, which may be later
   * than the first time it was seen.
   */
  lastUploadedAt: Date;
};

export const clientFlowImageKeyMap: CrudFetcherMapper<ClientFlowImage> = {
  list_slug: 'listSlug',
  image_file: 'imageFile',
  original_file_sha512: 'originalFileSha512',
  image_file_created_at: (_, v) => ({ key: 'imageFileCreatedAt', value: new Date(v * 1000) }),
  last_uploaded_at: (_, v) => ({ key: 'lastUploadedAt', value: new Date(v * 1000) }),
};
