import { OsehImageRef } from '../../shared/images/OsehImageRef';
import { CrudFetcherMapper } from '../crud/CrudFetcher';
import { HomeScreenImageFlags } from './flags/HomeScreenImageFlags';

export type HomeScreenImage = {
  /** Primary stable external row identifier */
  uid: string;
  /** The unaltered (beyond cropping and scaling) original image */
  imageFile: OsehImageRef;
  /** The darkened image */
  darkenedImageFile: OsehImageRef;
  /** The minimum number of seconds from midnight when this image can be shown */
  startTime: number;
  /** The maximum number of seconds from midnight when this image can be shown */
  endTime: number;
  /** The flags that determine when this image can be shown */
  flags: HomeScreenImageFlags | 0;
  /**
   * The YYYY-MM-DD dates when this image can be shown. If null, the image is
   * not restricted by this field. If empty, this image can never be shown.
   * Intended for e.g., holidays.
   */
  dates: string[] | null;
  /**
   * When this record was created
   */
  createdAt: Date;
  /**
   * Cannot be shown earlier than this date
   */
  liveAt: Date;
};

export const homeScreenImageKeyMap: CrudFetcherMapper<HomeScreenImage> = {
  image_file: 'imageFile',
  darkened_image_file: 'darkenedImageFile',
  start_time: 'startTime',
  end_time: 'endTime',
  created_at: (_, v) => ({ key: 'createdAt', value: new Date(v * 1000) }),
  live_at: (_, v) => ({ key: 'liveAt', value: new Date(v * 1000) }),
};
