import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenTriggerWithExitAPI,
  ScreenTriggerWithExitMapped,
} from '../../lib/convertTriggerWithExit';

type MembershipParams<T> = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** manages if they tap the back button at the top left */
  back: T;

  /** manages if they don't have Oseh+ and they press the upgrade button */
  upgrade: T;

  /** manages if they tap the home option in the bottom nav */
  home: T;

  /** manages if they tap the series option in the bottom nav */
  series: T;
};

export type MembershipAPIParams = MembershipParams<ScreenTriggerWithExitAPI>;
export type MembershipMappedParams = MembershipParams<ScreenTriggerWithExitMapped> & {
  __mapped: true;
};
