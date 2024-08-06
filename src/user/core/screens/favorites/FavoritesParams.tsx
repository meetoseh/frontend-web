import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenTriggerWithExitAPI,
  ScreenTriggerWithExitMapped,
} from '../../lib/convertTriggerWithExit';

type FavoritesParams<T> = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** manages if they tap the back button at the top left */
  back: T;

  /**
   * manages if they tap one of the journeys; triggered with 'journey' in the
   * server params via the pop_to_history_journey endpoint
   */
  journey: T;

  /** manages if they tap the history option in the top nav */
  history: T;

  /** manages if they tap the owned option in the top nav */
  owned: T;

  /** manages if they tap the home option in the bottom nav */
  home: T;

  /** manages if they tap the series option in the bottom nav */
  series: T;
};

export type FavoritesAPIParams = FavoritesParams<ScreenTriggerWithExitAPI>;

export type FavoritesMappedParams = FavoritesParams<ScreenTriggerWithExitMapped> & {
  __mapped: true;
};
