import { OsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { ExternalCoursePreviewable } from '../../../series/lib/ExternalCourse';

export type SeriesListResources = {
  /**
   * True if some resources are still being loaded, false if the screen is
   * ready to present.
   */
  loading: boolean;

  /**
   * The image handler for series list; reused for faster navigation
   */
  imageHandler: OsehImageStateRequestHandler;

  /**
   * The function to call if the user requests to go to their
   * account/settings page
   */
  gotoSettings: () => void;

  /**
   * The function to call to go to the course preview page for the given
   * course.
   */
  gotoCoursePreview: (course: ExternalCoursePreviewable) => void;
};
