import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';

export type HistoryAPIParams = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** manages if they tap the back button at the top left */
  back: {
    /** the trigger with no parameters */
    trigger: string | null;

    /** the transition to use */
    exit: StandardScreenTransition;
  };

  /**
   * manages if they tap one of the journeys; triggered with 'journey' in the
   * server params via the pop_to_history_journey endpoint
   */
  journey: {
    /** The trigger with 'journey' in the server params */
    trigger: string | null;

    /** The transition to use */
    exit: StandardScreenTransition;
  };

  /** manages if they tap the favorites option in the top nav */
  favorites: {
    /** the trigger with no parameters */
    trigger: string | null;

    /** The transition to use */
    exit: StandardScreenTransition;
  };

  /** manages if they tap the owned option in the top nav */
  owned: {
    /** the trigger with no parameters */
    trigger: string | null;

    /** The transition to use */
    exit: StandardScreenTransition;
  };

  /** manages if they tap the home option in the bottom nav */
  home: {
    /** the trigger with no parameters */
    trigger: string | null;

    /** the transition to use */
    exit: StandardScreenTransition;
  };

  /** manages if they tap the series option in the bottom nav */
  series: {
    /** the trigger with no parameters */
    trigger: string | null;

    /** the transition to use */
    exit: StandardScreenTransition;
  };
};

export type HistoryMappedParams = HistoryAPIParams & {
  __mapped?: true;
};
