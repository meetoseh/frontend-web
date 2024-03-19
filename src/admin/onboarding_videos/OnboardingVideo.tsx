import { OsehContentRef } from '../../shared/content/OsehContentRef';
import { OsehImageRef } from '../../shared/images/OsehImageRef';
import { CrudFetcherKeyMap } from '../crud/CrudFetcher';

export type OVPurposeWelcome = {
  /** Discriminatory field; indicates for first video after signing up */
  type: 'welcome';
  /** ISO 639-1 two-letter individual language code (lowercase), e.g., 'en' for english */
  language: string;
  /** The perceived gender of the speaker */
  voice: 'male' | 'female' | 'ambiguous' | 'multiple';
};

// only one right now
export type OnboardingVideoPurpose = OVPurposeWelcome;

/**
 * Determines if two OnboardingVideoPurpose objects are equal
 */
export const areOnboardingVideoPurposesEqual = (
  a: OnboardingVideoPurpose,
  b: OnboardingVideoPurpose
): boolean => a.type === b.type && a.language === b.language && a.voice === b.voice;

export type OnboardingVideo = {
  /** Primary stable external row identifier */
  uid: string;
  /** The purpose of the video; there is only one active onboarding video per purpose */
  purpose: OnboardingVideoPurpose;
  /** The actual video file */
  videoContent: OsehContentRef;
  /** The cover / thumbnail image */
  thumbnailImage: OsehImageRef;
  /** If this video can be served, the last time this flag was changed, otherwise null */
  activeAt: Date | null;
  /** Used solely for filtering in admin */
  visibleInAdmin: boolean;
  /** When this record was created in seconds since the epoch */
  createdAt: Date;
};

export const onboardingVideoKeyMap: CrudFetcherKeyMap<OnboardingVideo> = {
  video_content: 'videoContent',
  thumbnail_image: 'thumbnailImage',
  active_at: (_, v) => ({ key: 'activeAt', value: v === null ? null : new Date(v * 1000) }),
  visible_in_admin: 'visibleInAdmin',
  created_at: (_, v) => ({ key: 'createdAt', value: new Date(v * 1000) }),
};
