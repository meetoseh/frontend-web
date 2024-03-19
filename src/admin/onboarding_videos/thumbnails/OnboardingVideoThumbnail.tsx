import {
  CourseVideoThumbnail,
  courseVideoThumbnailKeyMap,
} from '../../courses/videos/thumbnails/CourseVideoThumbnail';
import { CrudFetcherMapper } from '../../crud/CrudFetcher';

export type OnboardingVideoThumbnail = CourseVideoThumbnail;
export const onboardingVideoThumbnailKeyMap: CrudFetcherMapper<OnboardingVideoThumbnail> =
  courseVideoThumbnailKeyMap;
