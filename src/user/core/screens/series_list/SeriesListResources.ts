import { OsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { InfiniteListing } from '../../../../shared/lib/InfiniteListing';
import { ExternalCourse } from '../../../series/lib/ExternalCourse';
import { ScreenResources } from '../../models/Screen';

export type SeriesListResources = ScreenResources & {
  /**
   * The list of series to render. Should be reset when starting exit transitions
   * to that its in the normal state if another component wants to use the list.
   */
  list: ValueWithCallbacks<InfiniteListing<ExternalCourse> | null>;

  /**
   * The expected height for course cover item images. Updates immediately.
   */
  imageHeight: ValueWithCallbacks<number>;

  /** The image handler adapter for this screen; attached to the main resources */
  imageHandler: OsehImageStateRequestHandler;
};
