import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenTriggerWithExitAPI,
  ScreenTriggerWithExitMapped,
} from '../../lib/convertTriggerWithExit';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerTransitioningPreferredAPI,
  ScreenConfigurableTriggerTransitioningTemporaryAPI,
} from '../../models/ScreenConfigurableTrigger';

type HistoryParams<T> = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** manages if they tap the back button at the top left */
  back: T;

  /**
   * manages if they tap one of the journeys; triggered with 'journey' in the
   * server params via the pop_to_history_journey endpoint
   */
  journey: T;

  /** manages if they tap the favorites option in the top nav */
  favorites: T;

  /** manages if they tap the owned option in the top nav */
  owned: T;

  /** manages if they tap the home option in the bottom nav */
  home: T;

  /** manages if they tap the series option in the bottom nav */
  series: T;
};

export type HistoryAPIParams = HistoryParams<ScreenTriggerWithExitAPI>;

export type HistoryMappedParams = HistoryParams<ScreenTriggerWithExitMapped> & {
  __mapped: true;
};
