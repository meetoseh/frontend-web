import { OsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { ExternalCourse } from '../../../series/lib/ExternalCourse';

export type SeriesPreviewResources = {
  /**
   * True if some resources are still being loaded, false if the screen is
   * ready to present.
   */
  loading: boolean;

  /**
   * The image handler we use for series previews; by storing this here,
   * we can more quickly load the page when the user navigates back to it.
   */
  imageHandler: OsehImageStateRequestHandler;

  /**
   * Can be called to return to the previous screen
   */
  goBack: () => void;

  /**
   * Can be called to display the series details on the given series,
   * presumably because they asked for it
   * @param series The series to show details for
   */
  gotoDetails: (series: ExternalCourse) => void;
};
