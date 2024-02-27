import { ExternalCourse } from '../../../series/lib/ExternalCourse';

/**
 * The minimum state required to determine if the series details screen should
 * be shown, plus any state we might want to share.
 */
export type SeriesDetailsState = {
  /**
   * The series that we want to show details for, if known. Null if we don't
   * want to show a series details, undefined if still loading
   */
  show: ExternalCourse | null | undefined;

  /**
   * Sets the value of `show`, usually because they either dismissed the
   * series details screen or clicked to go to a particular journey
   * within the series / to upgrade to oseh+.
   *
   * @param series The series to show or null to dismiss
   * @param updateWindowHistory True if the window history should be updated to
   *   reflect the new value of series, false to leave the window history
   *   alone.
   */
  setShow: (series: ExternalCourse | null, updateWindowHistory: boolean) => void;
};
