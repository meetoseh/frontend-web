import { CourseVideo, courseVideoKeyMap } from '../../courses/videos/CourseVideo';
import { CrudFetcherMapper } from '../../crud/CrudFetcher';

export type OnboardingVideoUpload = CourseVideo;
export const onboardingVideoUploadKeyMap: CrudFetcherMapper<OnboardingVideoUpload> =
  courseVideoKeyMap;
