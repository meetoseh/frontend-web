import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';

export type SimpleNavItemTrigger = {
  /**
   * - `trigger`: pops the screen when clicked
   */
  type: 'trigger';

  /** The text for the nav item */
  text: string;

  /** The flow to trigger if the link is clicked */
  trigger: string | null;
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

export type SimpleNavItem = SimpleNavItemTrigger | SimpleNavItemLink;

export type SimpleNavAPIParams = {
  /** entrance transition */
  entrance: StandardScreenTransition;

  /** exit transition; standard to keep params size down */
  exit: StandardScreenTransition;

  /** The flow to trigger if the click the x at the upper right */
  close: string | null;

  /**
   * The primary navigation options; larger and at the top
   */
  primary: SimpleNavItem[];

  /**
   * The secondary navigation options; smaller and at the bottom
   */
  secondary: SimpleNavItem[];
};

export type SimpleNavMappedParams = SimpleNavAPIParams & {
  __mapped: true;
};
