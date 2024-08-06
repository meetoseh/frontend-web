import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import {
  ScreenConfigurableTrigger,
  ScreenConfigurableTriggerTransitioningPreferredAPI,
  ScreenConfigurableTriggerTransitioningTemporaryAPI,
} from '../../models/ScreenConfigurableTrigger';

type SimpleNavItemTrigger<T> = T & {
  /**
   * - `trigger`: pops the screen when clicked
   */
  type: 'trigger';

  /** The text for the nav item */
  text: string;
};

export type SimpleNavItemLink = {
  /**
   * - `link`: opens a link in a new tab when clicked
   */
  type: 'link';

  /** the text for the nav item  */
  text: string;

  /** the url to open */
  url: string;
};

type SimpleNavItem<T> = SimpleNavItemTrigger<T> | SimpleNavItemLink;

type SimpleNavParams<T, CloseT> = CloseT & {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** exit transition; standard to keep params size down */
  exit: StandardScreenTransition;

  /**
   * The primary navigation options; larger and at the top
   */
  primary: SimpleNavItem<T>[];

  /**
   * The secondary navigation options; smaller and at the bottom
   */
  secondary: SimpleNavItem<T>[];
};

export type SimpleNavAPIParams = SimpleNavParams<
  {
    trigger: ScreenConfigurableTriggerTransitioningPreferredAPI;
    triggerv75: ScreenConfigurableTriggerTransitioningTemporaryAPI;
  },
  {
    close: ScreenConfigurableTriggerTransitioningPreferredAPI;
    closev75: ScreenConfigurableTriggerTransitioningTemporaryAPI;
  }
>;
export type SimpleNavMappedParams = SimpleNavParams<
  {
    trigger: ScreenConfigurableTrigger;
  },
  {
    close: ScreenConfigurableTrigger;
  }
> & {
  __mapped: true;
};
