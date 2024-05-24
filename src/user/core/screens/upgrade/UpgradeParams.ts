import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import { ScreenImageParsed } from '../../models/ScreenImage';

export type UpgradeAPIParams = {
  /** The header message */
  header: string;

  image: unknown;

  /** entrance transition */
  entrance: StandardScreenTransition;

  /** exit transition for the back button */
  exit: StandardScreenTransition;

  /** The client flow slug to trigger when they hit the back button with no parameters */
  back: string | null;
};

export type UpgradeMappedParams = Omit<UpgradeAPIParams, 'image'> & {
  /** The image to show at the top of the screen */
  image: ScreenImageParsed;
  __mapped?: true;
};
