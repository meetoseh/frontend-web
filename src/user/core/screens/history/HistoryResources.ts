import { OsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { InfiniteListing } from '../../../../shared/lib/InfiniteListing';
import { MinimalJourney } from '../../../favorites/lib/MinimalJourney';
import { ScreenResources } from '../../models/Screen';

export type HistoryResources = ScreenResources & {
  /**
   * The list of journeys to render. Should be reset when starting exit transitions
   * to that its in the normal state if another component wants to use the list.
   */
  list: ValueWithCallbacks<InfiniteListing<MinimalJourney> | null>;

  /** The image handler adapter for this screen; attached to the main resources */
  imageHandler: OsehImageStateRequestHandler;
};
