import { CrudFetcherMapper, convertUsingMapper } from '../../../admin/crud/CrudFetcher';
import { OsehContentRef } from '../../../shared/content/OsehContentRef';
import { OsehImageRef } from '../../../shared/images/OsehImageRef';
import { OsehTranscriptRef } from '../../../shared/transcripts/OsehTranscriptRef';
import {
  ExternalCourseInstructor,
  externalCourseInstructorKeyMap,
} from './ExternalCourseInstructor';

export type ExternalCourse = {
  /** Primary stable external identifier */
  uid: string;
  /** Primary human-selected URL-friendly identifier */
  slug: string;
  /** Title; usually rendered via the logo */
  title: string;
  /** Approximately 250-character description */
  description: string;
  /** The instructor */
  instructor: ExternalCourseInstructor;
  /** The darkened background image */
  backgroundImage: OsehImageRef;
  /** The logo, if available, usually with a vectorized option */
  logo: OsehImageRef | null;
  /** The entitlement identifier required to attach/access this course */
  revenueCatEntitlement: string;
  /** Whether the current user had the entitlement when this was fetched */
  hasEntitlement: boolean;
  /** When the user joined/attached the course, or null if they have not yet */
  joinedAt: Date | null;
  /** When the user last liked the course, or null if they have not yet */
  likedAt: Date | null;
  /** When the course was created */
  createdAt: Date;
  /** The number of journeys within the course */
  numJourneys: number;
  /** The introductory video for the series, if available */
  introVideo: OsehContentRef | null;
  /** The duration of the introductory video in seconds, if an intro video is available */
  introVideoDuration: number | null;
  /** The transcript for the intro video, if the intro video is available and its transcript is available */
  introVideoTranscript: OsehTranscriptRef | null;
  /** The cover image / thumbnail for the video, if available, otherwise null */
  introVideoThumbnail: OsehImageRef | null;
};

export const externalCourseKeyMap: CrudFetcherMapper<ExternalCourse> = {
  instructor: (_, v) => ({
    key: 'instructor',
    value: convertUsingMapper(v, externalCourseInstructorKeyMap),
  }),
  background_image: 'backgroundImage',
  revenue_cat_entitlement: 'revenueCatEntitlement',
  has_entitlement: 'hasEntitlement',
  joined_at: (_, v) => ({ key: 'joinedAt', value: v !== null ? new Date(v * 1000) : null }),
  liked_at: (_, v) => ({ key: 'likedAt', value: v !== null ? new Date(v * 1000) : null }),
  created_at: (_, v) => ({ key: 'createdAt', value: new Date(v * 1000) }),
  num_journeys: 'numJourneys',
  intro_video: 'introVideo',
  intro_video_duration: 'introVideoDuration',
  intro_video_transcript: 'introVideoTranscript',
  intro_video_thumbnail: 'introVideoThumbnail',
};
