import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';
import { ScreenImageParsed } from '../../models/ScreenImage';

export type UpgradeAPIParams = {
  /** The header message */
  header: string;

  image: unknown;

  /** entrance transition */
  entrance: StandardScreenTransition;

  /** exit transition for the back button. in native, this also applies to after checkout */
  exit: StandardScreenTransition;

  /** The client flow slug to trigger when they hit the back button with no parameters */
  back: string | null;

  checkout: {
    /**
     * On the web this is ignored and configured via empty_with_checkout_uid on the backend.
     * On the app, the trigger if checkout succeeds.
     *
     * In order for the behavior to be consistent, this cannot be configured.
     */
    success: 'post_checkout_success';

    /**
     * On the web this is ignored and configured via empty_with_checkout_uid on the backend.
     * On the app, the trigger if checkout fails.
     *
     * In order for the behavior to be consistent, this cannot be configured.
     */
    failure: 'post_checkout_failure';
  };
};

export type UpgradeMappedParams = Omit<UpgradeAPIParams, 'image'> & {
  /** The image to show at the top of the screen */
  image: ScreenImageParsed;
  __mapped?: true;
};
