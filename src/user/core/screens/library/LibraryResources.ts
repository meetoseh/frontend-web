import { ValueWithCallbacks, WritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { InfiniteListing } from '../../../../shared/lib/InfiniteListing';
import { ScreenResources } from '../../models/Screen';
import { LibraryFilter } from './lib/LibraryFilter';
import { SearchPublicInstructor } from './lib/SearchPublicInstructor';
import { SearchPublicJourney } from './lib/SearchPublicJourney';

export type LibraryResources = ScreenResources & {
  /**
   * The list of journeys to render. Should be reset when starting exit transitions
   * to that its in the normal state if another component wants to use the list.
   *
   * Null while loading, undefined if an error occurred.
   */
  list: ValueWithCallbacks<InfiniteListing<SearchPublicJourney> | null | undefined>;

  /**
   * The filter we are currently using for display purposes; if the user
   * uses the UI to update the filters, we will write to these filters and
   * expect the list to update.
   */
  filter: WritableValueWithCallbacks<LibraryFilter>;

  /**
   * All the instructors that the user can choose from; null while loading, undefined
   * if an error occurred preventing us from loading this list. Used to extract profile
   * pictures.
   */
  instructors: ValueWithCallbacks<SearchPublicInstructor[] | null | undefined>;
};
