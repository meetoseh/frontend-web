import { CrudFetcherKeyMap } from '../../crud/CrudFetcher';
import { JourneyAudioContent } from './JourneyAudioContent';

/**
 * The path to search journey audio content
 */
export const path = '/api/1/journeys/audio_contents/search';

/**
 * Provides the required translations for the api representation to our
 * internal representation
 */
export const keyMap: CrudFetcherKeyMap<JourneyAudioContent> = {
  content_file: 'contentFile',
  content_file_created_at: (_, val) => ({
    key: 'contentFileCreatedAt',
    value: new Date(val * 1000),
  }),
  uploaded_by_user_sub: 'uploadedByUserSub',
  last_uploaded_at: (_, val) => ({ key: 'lastUploadedAt', value: new Date(val * 1000) }),
};
