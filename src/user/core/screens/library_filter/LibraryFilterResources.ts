import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ScreenResources } from '../../models/Screen';
import { SearchPublicInstructor } from '../library/lib/SearchPublicInstructor';

export type LibraryFilterResources = ScreenResources & {
  /**
   * All the instructors that the user can choose from; null while loading, undefined
   * if an error occurred preventing us from loading this list.
   */
  instructors: ValueWithCallbacks<SearchPublicInstructor[] | null | undefined>;
};
