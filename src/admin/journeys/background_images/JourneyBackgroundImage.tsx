import { OsehImageRef } from '../../../shared/OsehImage';

/**
 * Indicates a specific image file is suitable as a journey background image
 */
export type JourneyBackgroundImage = {
  /**
   * The primary stable identifier of the join row indicating that the
   * given image file is suitable as a journey background image
   */
  uid: string;

  /**
   * A reference to the actual image file
   */
  imageFile: OsehImageRef;

  /**
   * A reference to the pre-blurred & darkened image file
   */
  blurredImageFile: OsehImageRef;

  /**
   * When the image file was first created
   */
  imageFileCreatedAt: Date;

  /**
   * The sub of the user who first uploaded the image file, if known
   */
  uploadedByUserSub: string | null;

  /**
   * When the image file was last uploaded; image files are de-duplicated
   * so this may be different from the image file's created at date
   */
  lastUploadedAt: Date;
};
