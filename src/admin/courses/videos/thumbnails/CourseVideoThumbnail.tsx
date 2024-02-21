import { OsehImageRef } from '../../../../shared/images/OsehImageRef';
import { CrudFetcherMapper } from '../../../crud/CrudFetcher';

export type CourseVideoThumbnailUserSource = {
  type: 'user';
  /** The sub of the user who uploaded this thumbnail */
  sub: string;
};

export type CourseVideoThumbnailFrameSource = {
  type: 'frame';
  /** The frame number that was extracted, 1-indexed */
  frameNumber: number;
  /** The SHA512 of the original source video this frame is intended for */
  videoSHA512: string;
  /** The SHA512 of the actual mp4 used to extract this frame */
  viaSHA512: string;
};

export type CourseVideoThumbnailSource =
  | CourseVideoThumbnailUserSource
  | CourseVideoThumbnailFrameSource;

export type CourseVideoThumbnail = {
  /** Primary stable external identifier */
  uid: string;

  /** How this thumbnail was created */
  source: CourseVideoThumbnailSource;

  /** The actual thumbnail */
  imageFile: OsehImageRef;

  /** When the image file was created */
  imageFileCreatedAt: Date;

  /** When the image file was last uploaded or extracted */
  lastUploadedAt: Date;
};

export const courseVideoThumbnailKeyMap: CrudFetcherMapper<CourseVideoThumbnail> = (raw: any) => ({
  uid: raw.uid,
  source: ((src) => {
    if (src.type === 'frame') {
      return {
        type: 'frame',
        frameNumber: src.frame_number,
        videoSHA512: src.video_sha512,
        viaSHA512: src.via_sha512,
      };
    }
    return src;
  })(raw),
  imageFile: raw.image_file,
  imageFileCreatedAt: new Date(raw.image_file_created_at * 1000),
  lastUploadedAt: new Date(raw.last_uploaded_at * 1000),
});
