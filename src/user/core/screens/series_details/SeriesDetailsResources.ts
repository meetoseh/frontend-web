import { OsehImageExportCropped } from '../../../../shared/images/OsehImageExportCropped';
import { ValueWithCallbacks, WritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { CourseJourneys } from '../../../series/lib/createSeriesJourneysRequestHandler';
import { CourseLikeState } from '../../../series/lib/createSeriesLikeStateRequestHandler';
import { ScreenResources } from '../../models/Screen';

export type SeriesDetailsResources = ScreenResources & {
  /** Thumbhash for the background, if available */
  backgroundThumbhash: ValueWithCallbacks<string | null>;

  /** The background image to use, if available, otherwise use a thumbhash or gradient */
  background: ValueWithCallbacks<OsehImageExportCropped | null>;

  /** If they have liked the course or not, null if no heart should be shown */
  likeState: ValueWithCallbacks<CourseLikeState | null>;

  /**
   * The journeys that are part of the course, if available, otherwise use a placeholder.
   */
  journeys: ValueWithCallbacks<CourseJourneys | null>;

  /**
   * The heights that are required for the background images. The component can update
   * these sizes if they are incorrect.
   */
  journeyBackgroundHeights: ValueWithCallbacks<WritableValueWithCallbacks<number>[]>;

  /**
   * The background images for the journeys. Use a hard black background for those which
   * aren't available, and stretch images to fit.
   */
  journeyBackgrounds: ValueWithCallbacks<ValueWithCallbacks<OsehImageExportCropped | null>[]>;
};
