import { OsehContentRef } from '../../shared/content/OsehContentRef';
import { OsehImageRef } from '../../shared/images/OsehImageRef';
import { CrudFetcherMapper } from '../crud/CrudFetcher';
import { Instructor } from '../instructors/Instructor';
import { CourseFlags } from './flags/CourseFlags';

export type CourseInstructor = Pick<Instructor, 'uid' | 'name' | 'picture'>;

export type Course = {
  /** Primary stable external identifier */
  uid: string;

  /** A human selected external identifier */
  slug: string;

  /** Access flags for the course */
  flags: CourseFlags;

  /**
   * The revenue cat entitlement required to attach or access this course.
   * If this course is attachable for free, then attaching grants this
   * entitlement permanently.
   */
  revenueCatEntitlement: string;

  /**
   * The title of the course
   */
  title: string;

  /**
   * The description of the course in around 250 characters
   */
  description: string;

  /**
   * The instructor for this course
   */
  instructor: CourseInstructor;

  /**
   * The background image for this course without any post-processing
   * (besides cropping and resizing)
   */
  backgroundOriginalImage: OsehImageRef | null;

  /**
   * The background image for this course after darkening (and cropping/resizing)
   */
  backgroundDarkenedImage: OsehImageRef | null;

  /**
   * The introductory video for this course
   */
  videoContent: OsehContentRef | null;

  /**
   * The thumbnail for the introductory video for this course
   */
  videoThumbnail: OsehImageRef | null;

  /**
   * The logo for this course, with a varying aspect ratio. Usually has an
   * SVG export, but also contains PNG exports at known widths.
   */
  logoImage: OsehImageRef | null;

  /*
   * The hero image for the share page at square aspect ratio for mobile
   * and 4:3 aspect ratio for desktop
   */
  heroImage: OsehImageRef | null;

  /** When this course row was first created */
  createdAt: Date;
};

export const courseKeyMap: CrudFetcherMapper<Course> = {
  revenue_cat_entitlement: 'revenueCatEntitlement',
  background_original_image: 'backgroundOriginalImage',
  background_darkened_image: 'backgroundDarkenedImage',
  video_content: 'videoContent',
  video_thumbnail: 'videoThumbnail',
  logo_image: 'logoImage',
  hero_image: 'heroImage',
  created_at: (_, v) => ({ key: 'createdAt', value: new Date(v * 1000) }),
};
