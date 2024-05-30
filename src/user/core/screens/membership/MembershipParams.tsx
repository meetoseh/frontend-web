import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';

export type MembershipAPIParams = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** manages if they tap the back button at the top left */
  back: {
    /** the trigger with no parameters */
    trigger: string | null;

    /** the transition to use */
    exit: StandardScreenTransition;
  };

  /** manages if they don't have Oseh+ and they press the upgrade button */
  upgrade: {
    /** the trigger with no parameters */
    trigger: string | null;

    /** the transition to use */
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

export type MembershipMappedParams = MembershipAPIParams & {
  __mapped?: true;
};
