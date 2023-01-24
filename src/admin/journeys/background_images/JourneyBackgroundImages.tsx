import { CrudFetcherKeyMap } from '../../crud/CrudFetcher';
import { JourneyBackgroundImage } from './JourneyBackgroundImage';

/**
 * The path to the search endpoint for journey background images
 */
export const path = '/api/1/journeys/background_images/search';

/**
 * Provides the necessary mappings to convert an api response to a
 * typed object for journey background images
 */
export const keyMap: CrudFetcherKeyMap<JourneyBackgroundImage> = {
  image_file: 'imageFile',
  blurred_image_file: 'blurredImageFile',
  image_file_created_at: (_, val) => ({ key: 'imageFileCreatedAt', value: new Date(val * 1000) }),
  uploaded_by_user_sub: 'uploadedByUserSub',
  last_uploaded_at: (_, val) => ({
    key: 'lastUploadedAt',
    value: val === null ? null : new Date(val * 1000),
  }),
};
