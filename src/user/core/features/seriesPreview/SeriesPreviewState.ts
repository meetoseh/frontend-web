import { ExternalCoursePreviewable } from '../../../series/lib/ExternalCourse';

export type SeriesPreviewShow = {
  /** the entrance animation to use */
  enter: 'fade' | 'wipe-up' | 'wipe-down';
  /** the course to show */
  course: ExternalCoursePreviewable;
};

/**
 * The minimum state required to determine if the series preview screen should
 * be shown, plus any state we might want to share.
 */
export type SeriesPreviewState = {
  /**
   * The series that we want to show a preview for, if known. Null if we don't
   * want to show a series preview, undefined if still loading
   */
  show: SeriesPreviewShow | null | undefined;

  /**
   * Sets the value of `show`, usually because they either dismissed the
   * series screen or clicked to go to series.
   *
   * @param series The series to show or null to dismiss
   * @param updateWindowHistory True if the window history should be updated to
   *   reflect the new value of series, false to leave the window history
   *   alone.
   */
  setShow: (show: SeriesPreviewShow | null, updateWindowHistory: boolean) => void;
};
