import { OsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { InfiniteListing } from '../../../../shared/lib/InfiniteListing';
import { MinimalCourseJourney } from '../../../favorites/lib/MinimalCourseJourney';
import { ScreenResources } from '../../models/Screen';

export type OwnedResources = ScreenResources & {
  /**
   * The list of journeys to render. Should be reset when starting exit transitions
   * to that its in the normal state if another component wants to use the list.
   */
  list: ValueWithCallbacks<InfiniteListing<MinimalCourseJourney> | null>;

  /** The image handler adapter for this screen; attached to the main resources */
  imageHandler: OsehImageStateRequestHandler;
};
